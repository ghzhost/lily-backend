import express from "express";
import rateLimit from "express-rate-limit";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app";
import { securityConfig } from "../src/config/env";

describe("TRUST_PROXY Express configuration and rate-limit isolation (issue #280)", () => {
  it("applies securityConfig.trustProxy to Express trust proxy setting", () => {
    const app = createApp();
    expect(app.get("trust proxy")).toBe(securityConfig.trustProxy);
  });

  it("rate limits requests with distinct X-Forwarded-For independently when trust proxy is 1", async () => {
    const app = express();
    app.set("trust proxy", 1);
    const limiter = rateLimit({
      windowMs: 60_000,
      limit: 2,
      standardHeaders: true,
      legacyHeaders: false,
    });
    app.use(limiter);
    app.get("/test", (req, res) => res.json({ ip: req.ip }));

    // Client A: 2 requests pass, 3rd is rate-limited
    const resA1 = await request(app).get("/test").set("X-Forwarded-For", "203.0.113.195");
    expect(resA1.status).toBe(200);

    const resA2 = await request(app).get("/test").set("X-Forwarded-For", "203.0.113.195");
    expect(resA2.status).toBe(200);

    const resA3 = await request(app).get("/test").set("X-Forwarded-For", "203.0.113.195");
    expect(resA3.status).toBe(429);

    // Client B: independent quota, request passes with 200 OK
    const resB1 = await request(app).get("/test").set("X-Forwarded-For", "198.51.100.17");
    expect(resB1.status).toBe(200);
  });

  it("shares rate-limit bucket when trust proxy is false", async () => {
    const app = express();
    app.set("trust proxy", false);
    const limiter = rateLimit({
      windowMs: 60_000,
      limit: 2,
      validate: { xForwardedForHeader: false },
    });
    app.use(limiter);
    app.get("/test", (req, res) => res.json({ ip: req.ip }));

    await request(app).get("/test").set("X-Forwarded-For", "203.0.113.195");
    await request(app).get("/test").set("X-Forwarded-For", "203.0.113.195");

    // Client B is blocked because both share the socket IP bucket
    const resB = await request(app).get("/test").set("X-Forwarded-For", "198.51.100.17");
    expect(resB.status).toBe(429);
  });
});
