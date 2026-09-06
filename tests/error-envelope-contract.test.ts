import rateLimit from "express-rate-limit";
import express, { type Express } from "express";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import request from "supertest";

import { errorHandler } from "../src/common/http/error.middleware";
import { rateLimitHandler } from "../src/config/rate-limit";
import { createApp } from "../src/app";
import { paymentsService } from "../src/modules/payments/payments.service";

/**
 * Pins the shared ApiErrorResponse envelope documented in
 * src/common/types/api-response.ts: { success: false, message, code?, details? }.
 * Every case below drives a representative request through the REAL
 * production handlers (validate middleware, not-found/method-not-allowed
 * middleware, payments service, rate-limit handler, error middleware) so a
 * regression in any single handler's envelope fails here.
 */
describe("Error envelope contract (issue #278)", () => {
  const app = createApp();

  const assertErrorEnvelope = (
    body: Record<string, unknown>,
    expectedCode: string | undefined,
    expectDetails: boolean,
  ) => {
    expect(body.success).toBe(false);
    expect(typeof body.message).toBe("string");
    expect((body.message as string).length).toBeGreaterThan(0);

    if (expectedCode === undefined) {
      expect(body).not.toHaveProperty("code");
    } else {
      expect(body).toHaveProperty("code", expectedCode);
    }

    if (expectDetails) {
      expect(body).toHaveProperty("details");
    }
  };

  it("400 validation errors carry code VALIDATION_ERROR and per-field details", async () => {
    const res = await request(app).post("/api/v1/agents").send({});

    expect(res.status).toBe(400);
    assertErrorEnvelope(res.body, "VALIDATION_ERROR", true);

    const details = res.body.details as {
      fieldErrors?: Record<string, unknown>;
    };
    expect(details.fieldErrors).toBeTypeOf("object");
  });

  it("404 route misses carry code NOT_FOUND", async () => {
    const res = await request(app).get("/api/v1/definitely-not-a-route");

    expect(res.status).toBe(404);
    assertErrorEnvelope(res.body, "NOT_FOUND", false);
  });

  it("404 agent misses keep the shared envelope without a code (handler defines none)", async () => {
    const res = await request(app).get("/api/v1/agents/agentlily_missing_id");

    expect(res.status).toBe(404);
    assertErrorEnvelope(res.body, undefined, false);
  });

  it("405 method-not-allowed keeps the shared envelope", async () => {
    const res = await request(app).patch("/api/v1/health").send({});

    expect(res.status).toBe(405);
    assertErrorEnvelope(res.body, undefined, false);
  });

  describe("410 expired quote", () => {
    beforeEach(() => {
      paymentsService.reset();
      vi.useFakeTimers({ toFake: ["Date"] });
    });

    afterEach(() => {
      paymentsService.reset();
      vi.useRealTimers();
    });

    it("keeps the shared envelope when an unread quote passes its TTL", async () => {
      const created = await request(app).post("/api/v1/payments").send({
        sourceAsset: "USDC",
        destinationAsset: "XLM",
        sourceAmount: "10.00",
      });
      expect(created.status).toBe(201);

      vi.advanceTimersByTime(5 * 60 * 1000 + 1);

      const res = await request(app).get(
        `/api/v1/payments/quotes/${created.body.data.quote.id}`,
      );

      expect(res.status).toBe(410);
      assertErrorEnvelope(res.body, undefined, false);
      expect(res.body.message).toBe("Quote has expired");
    });
  });

  describe("429 rate limit", () => {
    // The production apiRateLimiter skips when NODE_ENV is "test", so drive
    // the REAL production rateLimitHandler through an equivalent limiter.
    const createLimitedApp = (): Express => {
      const limited = express();
      limited.use(
        "/api/v1",
        rateLimit({
          windowMs: 60_000,
          limit: 1,
          standardHeaders: true,
          legacyHeaders: false,
          handler: rateLimitHandler,
        }),
      );
      limited.get("/api/v1/ping", (_req, res) => {
        res.json({ success: true, data: { ok: true } });
      });
      return limited;
    };

    it("keeps the shared envelope with reset details once the limit is exceeded", async () => {
      const limited = createLimitedApp();

      await request(limited).get("/api/v1/ping");
      const res = await request(limited).get("/api/v1/ping");

      expect(res.status).toBe(429);
      assertErrorEnvelope(res.body, undefined, true);
      expect(res.body.message).toBe(
        "Too many requests, please try again later.",
      );
    });
  });

  describe("500 internal errors", () => {
    // Non-AppError exceptions reach the REAL error middleware with status 500.
    const createThrowingApp = (): Express => {
      const throwing = express();
      throwing.use(express.json());
      throwing.get("/throw", () => {
        throw new Error("simulated internal failure");
      });
      throwing.use(errorHandler);
      return throwing;
    };

    it("keeps the shared envelope without a code for unexpected errors", async () => {
      const res = await request(createThrowingApp()).get("/throw");

      expect(res.status).toBe(500);
      assertErrorEnvelope(res.body, undefined, false);
    });
  });
});
