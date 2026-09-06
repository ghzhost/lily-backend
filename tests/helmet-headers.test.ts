import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";

describe("Helmet security headers (issue #135)", () => {
  const app = createApp();

  it("should set X-Content-Type-Options: nosniff", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
  });

  it("should set Content-Security-Policy header", async () => {
    const res = await request(app).get("/api/v1/health");
    const csp = res.headers["content-security-policy"];
    expect(csp).toBeDefined();
    expect(typeof csp).toBe("string");
    expect((csp as string).length).toBeGreaterThan(0);
  });

  it("should set X-Frame-Options header", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.headers["x-frame-options"]).toBeDefined();
  });

  it("should set Referrer-Policy header", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.headers["referrer-policy"]).toBeDefined();
  });

  it("should not include X-Powered-By header", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.headers["x-powered-by"]).toBeUndefined();
  });

  it("should set Cross-Origin-Resource-Policy: cross-origin (intentional override)", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.headers["cross-origin-resource-policy"]).toBe("cross-origin");
  });
});
