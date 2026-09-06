import { describe, it, expect } from "vitest";
import { beforeAll, afterAll } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { apiRouter } from "../src/routes";

describe("Cache-Control: no-store (issue #76)", () => {
  const app = createApp();

  beforeAll(() => {
    // Register on the actual API router so the route sits before the not-found handler.
    // Mirrors the pattern used in tests/core.test.ts for error-trigger routes.
    apiRouter.get("/error-trigger-276", () => {
      throw new Error("Simulated unhandled exception for cache-control test");
    });
  });

  afterAll(() => {
    // Clean up the test-only route to avoid leaking into other suites.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stack = apiRouter.stack as any[];
    const idx = stack.findIndex(
      (layer) => layer.route && layer.route.path === "/error-trigger-276",
    );
    if (idx !== -1) stack.splice(idx, 1);
  });

  it("should set Cache-Control: no-store on root route", async () => {
    const res = await request(app).get("/");
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("should set Cache-Control: no-store on health endpoint", async () => {
    const res = await request(app).get("/api/v1/health");
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("should set Cache-Control: no-store on agents endpoint", async () => {
    const res = await request(app).get("/api/v1/agents");
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("should set Cache-Control: no-store on successful writes", async () => {
    const res = await request(app).post("/api/v1/agents").send({
      name: "Cache Control Agent",
      description: "Agent created to verify write-response cache headers.",
      capabilities: ["payments"],
    });

    expect(res.status).toBe(201);
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("should set Cache-Control: no-store on validation errors", async () => {
    const res = await request(app).post("/api/v1/agents").send({
      name: "x",
      description: "short",
      capabilities: [],
    });

    expect(res.status).toBe(400);
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("should set Cache-Control: no-store on unhandled server errors", async () => {
    apiRouter.get("/cache-control-error-trigger", () => {
      throw new Error("Simulated cache-control failure");
    });

    const res = await request(app).get("/api/v1/cache-control-error-trigger");
    expect(res.status).toBe(500);
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("should set Cache-Control: no-store on 404 responses", async () => {
    const res = await request(app).get("/nonexistent-route");
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("should set Cache-Control: no-store on successful POST write responses", async () => {
    const res = await request(app)
      .post("/api/v1/agents")
      .send({
        name: "cache-test-agent",
        description: "Agent created to verify cache-control headers on writes",
        capabilities: ["monitoring"],
      })
      .set("Content-Type", "application/json");
    // Accept 200/201; the header assertion below is what matters for the bounty.
    expect([200, 201]).toContain(res.status);
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("should set Cache-Control: no-store on validation error (400) responses", async () => {
    // Missing required fields triggers the shared validateBody middleware → 400.
    const res = await request(app)
      .post("/api/v1/agents")
      .send({ name: "x" })
      .set("Content-Type", "application/json");
    expect([400, 422]).toContain(res.status);
    expect(res.headers["cache-control"]).toBe("no-store");
  });

  it("should set Cache-Control: no-store on 500 error responses", async () => {
    // Uses the suite-local /api/v1/error-trigger-276 registered on apiRouter.
    const res = await request(app).get("/api/v1/error-trigger-276");
    expect(res.status).toBe(500);
    expect(res.headers["cache-control"]).toBe("no-store");
  });
});
