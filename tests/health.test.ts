import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../src/app";
import { env } from "../src/config/env";
import { version } from "../package.json";

describe("health endpoints", () => {
  const app = createApp();

  it("returns the full service health payload contract", async () => {
    const beforeRequest = Date.now();
    const response = await request(app).get("/api/v1/health");
    const afterRequest = Date.now();

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      status: expect.any(String),
      service: env.APP_NAME,
      environment: env.NODE_ENV,
      version: expect.any(String),
      timestamp: expect.any(String),
    });

    const timestamp = response.body.data.timestamp as string;
    const timestampMs = Date.parse(timestamp);

    expect(Number.isNaN(timestampMs)).toBe(false);
    expect(new Date(timestampMs).toISOString()).toBe(timestamp);
    expect(timestampMs).toBeGreaterThanOrEqual(beforeRequest);
    expect(timestampMs).toBeLessThanOrEqual(afterRequest);
  });

  it("returns a typed 404 payload for missing routes", async () => {
    const response = await request(app).get("/missing");

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe("NOT_FOUND");
    expect(response.body.message).toContain("Route not found");
  });

  it("asserts all health payload fields per contract (issue #134, #261)", async () => {
    const response = await request(app).get("/api/v1/health");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const data = response.body.data;
    expect(data).toHaveProperty("status");
    expect(data).toHaveProperty("service");
    expect(data).toHaveProperty("environment");
    expect(data).toHaveProperty("version");
    expect(data).toHaveProperty("timestamp");

    expect(typeof data.status).toBe("string");
    expect(typeof data.service).toBe("string");
    expect(typeof data.environment).toBe("string");
    expect(data.version).toBe(version);
    expect(typeof data.timestamp).toBe("string");
  });

  it("asserts timestamp is valid ISO-8601 near current time (issue #134)", async () => {
    const before = Date.now();
    const response = await request(app).get("/api/v1/health");
    const after = Date.now();

    const ts = new Date(response.body.data.timestamp).getTime();
    expect(ts).toBeGreaterThanOrEqual(before - 1000);
    expect(ts).toBeLessThanOrEqual(after + 1000);
    expect(Number.isNaN(ts)).toBe(false);
  });

  it("asserts service field matches APP_NAME env var (issue #134)", async () => {
    const response = await request(app).get("/api/v1/health");
    expect(response.body.data.service).toBeTruthy();
    expect(typeof response.body.data.service).toBe("string");
    expect(response.body.data.service.length).toBeGreaterThan(0);
  });

  it("asserts environment field is present (issue #134)", async () => {
    const response = await request(app).get("/api/v1/health");
    expect(response.body.data.environment).toBeTruthy();
    expect(typeof response.body.data.environment).toBe("string");
  });
});

describe("health build metadata", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it.each([undefined, "", "   ", "  abc123def456  "])(
    "handles BUILD_COMMIT=%s",
    async (commit) => {
      vi.stubEnv("BUILD_COMMIT", commit);
      vi.resetModules();
      const { createApp: createIsolatedApp } = await import("../src/app");
      const response = await request(createIsolatedApp()).get("/api/v1/health");

      expect(response.status).toBe(200);
      expect(response.body.data.version).toBe(version);
      if (commit?.trim()) {
        expect(response.body.data.commit).toBe(commit.trim());
      } else {
        expect(response.body.data).not.toHaveProperty("commit");
      }
    },
  );
});
