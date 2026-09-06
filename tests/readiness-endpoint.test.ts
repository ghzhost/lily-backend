import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";

describe("Readiness and liveness endpoints (issue #120)", () => {
  const app = createApp();

  it("GET /api/v1/health should return ok status as alias", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("ok");
  });

  it("GET /api/v1/health/live should return liveness details", async () => {
    const res = await request(app).get("/api/v1/health/live");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("ok");
    expect(res.body.data.service).toEqual(expect.any(String));
    expect(new Date(res.body.data.timestamp).toISOString()).toBe(
      res.body.data.timestamp,
    );
  });

  it("GET /api/v1/health/ready should return dependency readiness", async () => {
    const res = await request(app).get("/api/v1/health/ready");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("ok");
    expect(res.body.data.checks).toEqual({ dependencies: "ok" });
    expect(res.body.data).toHaveProperty("timestamp");
  });

  it("liveness and readiness should both use standard success envelope", async () => {
    const liveRes = await request(app).get("/api/v1/health/live");
    const readyRes = await request(app).get("/api/v1/health/ready");

    for (const res of [liveRes, readyRes]) {
      expect(res.body).toHaveProperty("success", true);
      expect(res.body).toHaveProperty("data");
    }
  });
});
