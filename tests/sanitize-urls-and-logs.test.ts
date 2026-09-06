import express from "express";
import request from "supertest";
import { describe, expect, it, vi, afterEach } from "vitest";

import { createApp } from "../src/app";
import { AppError } from "../src/common/http/app-error";
import { errorHandler } from "../src/common/http/error.middleware";
import { logger } from "../src/config/logger";

describe("Sanitize request URLs in error handling and access logs (issues #282 & #283)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should sanitize sensitive query parameters in errorHandler logs", async () => {
    const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => {});
    const app = express();
    app.get("/test-error", () => {
      throw new AppError(400, "Invalid input");
    });
    app.use(errorHandler);

    const res = await request(app).get(
      "/test-error?api_key=secret-token&seed=super-secret-seed&safe=visible",
    );

    expect(res.status).toBe(400);
    expect(warnSpy).toHaveBeenCalledOnce();
    const logCallArg = warnSpy.mock.calls[0][0] as {
      method: string;
      path: string;
      statusCode: number;
    };
    expect(logCallArg.path).toContain("safe=visible");
    expect(logCallArg.path).toContain("api_key=%5BREDACTED%5D");
    expect(logCallArg.path).toContain("seed=%5BREDACTED%5D");
    expect(logCallArg.path).not.toContain("secret-token");
    expect(logCallArg.path).not.toContain("super-secret-seed");
  });

  it("should omit query strings from 404 Route not found response messages", async () => {
    const app = createApp();

    const res = await request(app).get(
      "/api/v1/non-existent-route?api_key=leak123&seed=seed123&foo=bar",
    );

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Route not found: GET /api/v1/non-existent-route");
    expect(res.body.message).not.toContain("api_key");
    expect(res.body.message).not.toContain("leak123");
    expect(res.body.message).not.toContain("seed123");
  });

  it("should redact case-variant and hyphenated query keys in production access logs", async () => {
    const app = createApp();
    const logs: Array<{ req?: Record<string, unknown> }> = [];
    const originalWrite = process.stdout.write;
    process.stdout.write = ((chunk: unknown) => {
      try {
        const line = typeof chunk === "string" ? chunk : String(chunk);
        const parsed = JSON.parse(line.trim()) as {
          req?: Record<string, unknown>;
        };
        if (parsed.req) logs.push(parsed);
      } catch {
        // ignore
      }
      return true;
    }) as unknown as typeof process.stdout.write;

    await request(app).get(
      "/api/v1/agents?API_KEY=leak1&Api-Key=leak2&access_token=leak3&sig=leak4&sort=asc",
    );

    await vi.waitFor(() => {
      expect(logs.length).toBeGreaterThan(0);
    });

    process.stdout.write = originalWrite;

    const reqLog = logs[0]!.req;
    expect(reqLog?.url).toContain("sort=asc");
    expect(reqLog?.url).toContain("API_KEY=%5BREDACTED%5D");
    expect(reqLog?.url).toContain("Api-Key=%5BREDACTED%5D");
    expect(reqLog?.url).toContain("access_token=%5BREDACTED%5D");
    expect(reqLog?.url).toContain("sig=%5BREDACTED%5D");
    expect(reqLog?.url).not.toContain("leak1");
    expect(reqLog?.url).not.toContain("leak2");
    expect(reqLog?.url).not.toContain("leak3");
    expect(reqLog?.url).not.toContain("leak4");
  });
});
