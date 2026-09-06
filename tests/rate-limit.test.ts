import { describe, it, expect } from "vitest";

import { rateLimitHandler } from "../src/config/rate-limit";
import type { Request, Response } from "express";

interface MockResult {
  res: Response;
  statusCode: number | null;
  body: Record<string, unknown> | null;
  retryAfter: string | null;
}

function createMockResponse(opts: { resetTime: Date | null }): MockResult {
  const result: MockResult = {
    res: {} as Response,
    statusCode: null,
    body: null,
    retryAfter: null,
  };

  const res = {
    locals: {
      rateLimit: {
        resetTime: opts.resetTime,
      },
    },
    setHeader: (name: string, value: string) => {
      if (name === "Retry-After") result.retryAfter = value;
    },
    status: (code: number) => {
      result.statusCode = code;
      return {
        json: (b: Record<string, unknown>) => {
          result.body = b;
        },
      };
    },
  };

  result.res = res as unknown as Response;
  return result;
}

describe("Rate limiter error envelope (issue #79)", () => {
  it("returns the standard ApiErrorResponse shape on 429", () => {
    const mock = createMockResponse({
      resetTime: new Date(Date.now() + 60_000),
    });

    rateLimitHandler({} as Request, mock.res);

    expect(mock.statusCode).toBe(429);
    expect(mock.body).not.toBeNull();
    expect(mock.body!.success).toBe(false);
    expect(typeof mock.body!.message).toBe("string");
    expect((mock.body!.message as string).length).toBeGreaterThan(0);
  });

  it("sets Retry-After header when resetTime is in the future", () => {
    const mock = createMockResponse({
      resetTime: new Date(Date.now() + 30_000),
    });

    rateLimitHandler({} as Request, mock.res);

    expect(mock.retryAfter).not.toBeNull();
    expect(Number(mock.retryAfter)).toBeGreaterThan(0);
  });

  it("includes details with resetTime in the response body", () => {
    const resetTime = new Date(Date.now() + 5_000);
    const mock = createMockResponse({ resetTime });

    rateLimitHandler({} as Request, mock.res);

    expect(mock.body).not.toBeNull();
    expect(mock.body!.success).toBe(false);
    expect(mock.body!.details).toBeDefined();
    expect((mock.body!.details as Record<string, unknown>).resetTime).toBe(
      resetTime.toISOString(),
    );
  });

  it("omits Retry-After when resetTime is null", () => {
    const mock = createMockResponse({
      resetTime: null,
    });

    rateLimitHandler({} as Request, mock.res);

    expect(mock.retryAfter).toBeNull();
    expect(mock.statusCode).toBe(429);
    expect(mock.body).not.toBeNull();
    expect(mock.body!.success).toBe(false);
    expect(
      (mock.body!.details as Record<string, unknown>).resetTime,
    ).toBeNull();
  });
});

describe("Operational endpoints rate-limit exemption (issue #285)", () => {
  it("correctly identifies operational vs business paths with default prefix", async () => {
    const { isOperationalPath } = await import("../src/config/rate-limit");

    // Root and operational paths
    expect(isOperationalPath("/")).toBe(true);
    expect(isOperationalPath("/api/v1/health")).toBe(true);
    expect(isOperationalPath("/api/v1/health/live")).toBe(true);
    expect(isOperationalPath("/api/v1/health/ready")).toBe(true);
    expect(isOperationalPath("/api/v1/metrics")).toBe(true);
    expect(isOperationalPath("/health/live")).toBe(true);
    expect(isOperationalPath("/metrics")).toBe(true);

    // Business endpoints
    expect(isOperationalPath("/api/v1/agents")).toBe(false);
    expect(isOperationalPath("/api/v1/payments")).toBe(false);
    expect(isOperationalPath("/api/v1/payments/quote")).toBe(false);
  });

  it("identifies operational paths with a non-default API_PREFIX", async () => {
    const { isOperationalPath } = await import("../src/config/rate-limit");
    const customPrefix = "/internal/api/v2";

    expect(isOperationalPath("/internal/api/v2/health", customPrefix)).toBe(
      true,
    );
    expect(
      isOperationalPath("/internal/api/v2/health/live", customPrefix),
    ).toBe(true);
    expect(isOperationalPath("/internal/api/v2/metrics", customPrefix)).toBe(
      true,
    );

    expect(isOperationalPath("/internal/api/v2/agents", customPrefix)).toBe(
      false,
    );
    expect(isOperationalPath("/internal/api/v2/payments", customPrefix)).toBe(
      false,
    );
  });

  it("permits unlimited requests to health/live while rate-limiting business routes", async () => {
    const express = (await import("express")).default;
    const request = (await import("supertest")).default;
    const { createApiRateLimiter } = await import("../src/config/rate-limit");

    const app = express();
    const testLimit = 3;

    // Rate limiter configured with limit=3 and test bypass disabled
    app.use(
      "/api/v1",
      createApiRateLimiter({
        limit: testLimit,
        windowMs: 60_000,
        apiPrefix: "/api/v1",
      }),
    );

    app.get("/api/v1/health/live", (_req, res) => {
      res.status(200).json({ status: "ok" });
    });

    app.get("/api/v1/agents", (_req, res) => {
      res.status(200).json({ agents: [] });
    });

    // Make more requests than testLimit to /api/v1/health/live with x-test-rate-limit header
    for (let i = 0; i < testLimit + 5; i++) {
      const res = await request(app)
        .get("/api/v1/health/live")
        .set("x-test-rate-limit", "true");
      expect(res.status).toBe(200);
      expect(res.body.status).toBe("ok");
    }

    // Requests to business endpoint /api/v1/agents must be limited after testLimit
    for (let i = 0; i < testLimit; i++) {
      const res = await request(app)
        .get("/api/v1/agents")
        .set("x-test-rate-limit", "true");
      expect(res.status).toBe(200);
    }

    const exceededRes = await request(app)
      .get("/api/v1/agents")
      .set("x-test-rate-limit", "true");
    expect(exceededRes.status).toBe(429);
    expect(exceededRes.body.success).toBe(false);
    expect(exceededRes.body.message).toContain("Too many requests");
  });

  it("works for non-default API_PREFIX in an express app", async () => {
    const express = (await import("express")).default;
    const request = (await import("supertest")).default;
    const { createApiRateLimiter } = await import("../src/config/rate-limit");

    const app = express();
    const customPrefix = "/custom/prefix";
    const testLimit = 2;

    app.use(
      customPrefix,
      createApiRateLimiter({
        limit: testLimit,
        windowMs: 60_000,
        apiPrefix: customPrefix,
      }),
    );

    app.get(`${customPrefix}/health/live`, (_req, res) => {
      res.status(200).json({ status: "ok" });
    });

    app.get(`${customPrefix}/agents`, (_req, res) => {
      res.status(200).json({ agents: [] });
    });

    // Operational route bypasses limit
    for (let i = 0; i < testLimit + 4; i++) {
      const res = await request(app)
        .get(`${customPrefix}/health/live`)
        .set("x-test-rate-limit", "true");
      expect(res.status).toBe(200);
    }

    // Business route hits limit
    for (let i = 0; i < testLimit; i++) {
      const res = await request(app)
        .get(`${customPrefix}/agents`)
        .set("x-test-rate-limit", "true");
      expect(res.status).toBe(200);
    }

    const blocked = await request(app)
      .get(`${customPrefix}/agents`)
      .set("x-test-rate-limit", "true");
    expect(blocked.status).toBe(429);
  });
});
