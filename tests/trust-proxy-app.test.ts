import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import request from "supertest";

describe(
  "Express trust proxy application and rate limiting (issue #280)",
  { timeout: 20000 },
  () => {
    const originalEnv = process.env;

    beforeEach(() => {
      vi.resetModules();
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
      vi.restoreAllMocks();
    });

    it("should apply default false to trust proxy when TRUST_PROXY is unset", async () => {
      delete process.env.TRUST_PROXY;
      process.env.NODE_ENV = "test";
      const { createApp } = await import("../src/app");
      const app = createApp();

      expect(app.get("trust proxy")).toBe(false);
    });

    it("should apply integer hop count to trust proxy when TRUST_PROXY is numeric", async () => {
      process.env.TRUST_PROXY = "1";
      process.env.NODE_ENV = "test";
      const { createApp } = await import("../src/app");
      const app = createApp();

      expect(app.get("trust proxy")).toBe(1);
    });

    it("should apply 'loopback' to trust proxy when TRUST_PROXY is loopback", async () => {
      process.env.TRUST_PROXY = "loopback";
      process.env.NODE_ENV = "test";
      const { createApp } = await import("../src/app");
      const app = createApp();

      expect(app.get("trust proxy")).toBe("loopback");
    });

    it("should pass securityConfig.trustProxy to app.set during initialization", async () => {
      process.env.TRUST_PROXY = "2";
      process.env.NODE_ENV = "test";
      const express = await import("express");
      const setSpy = vi.spyOn(express.application, "set");

      const { createApp } = await import("../src/app");
      const { securityConfig } = await import("../src/config/env");

      createApp();

      expect(setSpy).toHaveBeenCalledWith(
        "trust proxy",
        securityConfig.trustProxy,
      );
      expect(securityConfig.trustProxy).toBe(2);
    });

    it("should rate limit distinct X-Forwarded-For IPs independently when TRUST_PROXY=1", async () => {
      process.env.TRUST_PROXY = "1";
      process.env.RATE_LIMIT_MAX_REQUESTS = "2";
      process.env.RATE_LIMIT_WINDOW_MS = "60000";
      process.env.NODE_ENV = "development"; // enable apiRateLimiter (skip is false in non-test)

      const { createApp } = await import("../src/app");
      const app = createApp();

      const clientA = "203.0.113.195";
      const clientB = "198.51.100.17";

      // Client A makes 2 allowed requests
      const resA1 = await request(app)
        .get("/api/v1/health")
        .set("X-Forwarded-For", clientA);
      expect(resA1.status).toBe(200);

      const resA2 = await request(app)
        .get("/api/v1/health")
        .set("X-Forwarded-For", clientA);
      expect(resA2.status).toBe(200);

      // Client A 3rd request exceeds limit
      const resA3 = await request(app)
        .get("/api/v1/health")
        .set("X-Forwarded-For", clientA);
      expect(resA3.status).toBe(429);
      expect(resA3.body.success).toBe(false);
      expect(resA3.body.message).toContain("Too many requests");

      // Client B from different IP must not be blocked by Client A's limit
      const resB1 = await request(app)
        .get("/api/v1/health")
        .set("X-Forwarded-For", clientB);
      expect(resB1.status).toBe(200);

      const resB2 = await request(app)
        .get("/api/v1/health")
        .set("X-Forwarded-For", clientB);
      expect(resB2.status).toBe(200);

      // Client B 3rd request exceeds limit
      const resB3 = await request(app)
        .get("/api/v1/health")
        .set("X-Forwarded-For", clientB);
      expect(resB3.status).toBe(429);
      expect(resB3.body.success).toBe(false);
    });

    it("should record client IP from X-Forwarded-For in request logs when TRUST_PROXY=1", async () => {
      process.env.TRUST_PROXY = "1";
      process.env.NODE_ENV = "test";

      const { createApp } = await import("../src/app");
      const app = createApp();

      const logs: Array<{ req?: { remoteAddress?: string; url?: string } }> =
        [];
      const originalWrite = process.stdout.write;
      process.stdout.write = ((chunk: unknown) => {
        try {
          const line = typeof chunk === "string" ? chunk : String(chunk);
          const parsed = JSON.parse(line.trim()) as {
            req?: { remoteAddress?: string; url?: string };
          };
          if (parsed.req) logs.push(parsed);
        } catch {
          // ignore non-json logs
        }
        return true;
      }) as unknown as typeof process.stdout.write;

      try {
        await request(app)
          .get("/api/v1/agents")
          .set("X-Forwarded-For", "203.0.113.195");

        await vi.waitFor(() => {
          expect(logs.length).toBeGreaterThan(0);
        });

        const matchedLog = logs.find((l) =>
          l.req?.url?.includes("/api/v1/agents"),
        );
        expect(matchedLog).toBeDefined();
        expect(matchedLog?.req?.remoteAddress).toBe("203.0.113.195");
      } finally {
        process.stdout.write = originalWrite;
      }
    });
  },
);
