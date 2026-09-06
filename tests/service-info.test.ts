import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("service build metadata", () => {
  afterEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
  });

  it("always exposes the package version and omits absent commit metadata", async () => {
    vi.stubEnv("BUILD_COMMIT", "");
    const { buildInfo } = await import("../src/config/build-info");

    expect(buildInfo).toEqual({ version: "1.0.0" });
  });

  it("exposes a configured build commit when available", async () => {
    vi.stubEnv("BUILD_COMMIT", "abc123def456");
    const { buildInfo } = await import("../src/config/build-info");

    expect(buildInfo).toEqual({
      version: "1.0.0",
      commit: "abc123def456",
    });
  });

  it("includes version and optional commit metadata in the health response", async () => {
    vi.stubEnv("BUILD_COMMIT", "abc123def456");
    const { createApp } = await import("../src/app");

    const response = await request(createApp()).get("/api/v1/health");

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      version: "1.0.0",
      commit: "abc123def456",
    });
  });
});
