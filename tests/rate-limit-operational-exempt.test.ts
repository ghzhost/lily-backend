import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import rateLimit from "express-rate-limit";
import { isOperationalPath, rateLimitHandler } from "../src/config/rate-limit";

describe("Operational endpoint rate limit exemption (issue #285)", () => {
  const createTestApp = (prefix: string = "/api/v1", limit: number = 2) => {
    const app = express();
    app.use(express.json());

    const limiter = rateLimit({
      windowMs: 60_000,
      limit,
      standardHeaders: true,
      legacyHeaders: false,
      skip: (req) => isOperationalPath(req, prefix),
      handler: rateLimitHandler,
    });

    app.use(prefix, limiter);

    // Mock operational endpoints
    app.get(`${prefix}/health`, (_req, res) => res.json({ success: true, status: "ok" }));
    app.get(`${prefix}/health/live`, (_req, res) => res.json({ success: true, status: "live" }));
    app.get(`${prefix}/health/ready`, (_req, res) => res.json({ success: true, status: "ready" }));
    app.get(`${prefix}/metrics`, (_req, res) => res.json({ success: true, metrics: {} }));

    // Mock business endpoint
    app.get(`${prefix}/agents`, (_req, res) => res.json({ success: true, data: [] }));

    return app;
  };

  it("allows more than limit sequential requests to /health/live without being rate limited", async () => {
    const app = createTestApp("/api/v1", 2);

    for (let i = 0; i < 10; i++) {
      const res = await request(app).get("/api/v1/health/live");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.status).toBe("live");
    }
  });

  it("allows sequential requests to /health/ready, /health, and /metrics without rate limiting", async () => {
    const app = createTestApp("/api/v1", 2);

    for (let i = 0; i < 5; i++) {
      const healthRes = await request(app).get("/api/v1/health");
      expect(healthRes.status).toBe(200);

      const readyRes = await request(app).get("/api/v1/health/ready");
      expect(readyRes.status).toBe(200);

      const metricsRes = await request(app).get("/api/v1/metrics");
      expect(metricsRes.status).toBe(200);
    }
  });

  it("still rate limits business endpoints when limit is exceeded", async () => {
    const app = createTestApp("/api/v1", 2);

    const res1 = await request(app).get("/api/v1/agents");
    expect(res1.status).toBe(200);

    const res2 = await request(app).get("/api/v1/agents");
    expect(res2.status).toBe(200);

    const res3 = await request(app).get("/api/v1/agents");
    expect(res3.status).toBe(429);
    expect(res3.body.success).toBe(false);
    expect(res3.body.message).toContain("Too many requests");
  });

  it("works with non-default custom API_PREFIX (/api/v2)", async () => {
    const app = createTestApp("/api/v2", 2);

    // Health probes under custom prefix should be exempted
    for (let i = 0; i < 5; i++) {
      const res = await request(app).get("/api/v2/health/live");
      expect(res.status).toBe(200);
    }

    // Business endpoints under custom prefix should be rate limited
    const res1 = await request(app).get("/api/v2/agents");
    expect(res1.status).toBe(200);

    const res2 = await request(app).get("/api/v2/agents");
    expect(res2.status).toBe(200);

    const res3 = await request(app).get("/api/v2/agents");
    expect(res3.status).toBe(429);
    expect(res3.body.success).toBe(false);
  });
});
