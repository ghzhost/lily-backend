import { describe, it, expect } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";

describe("Success envelope contract (issue #130)", () => {
  const app = createApp();

  const successEndpoints = [
    { method: "get", path: "/api/v1/health" },
    { method: "get", path: "/api/v1/agents" },
    {
      method: "post",
      path: "/api/v1/agents",
      body: {
        name: "Envelope Test Agent",
        description: "Testing success envelope contract",
        capabilities: ["test"],
      },
    },
  ];

  for (const endpoint of successEndpoints) {
    it(`${endpoint.method.toUpperCase()} ${endpoint.path} returns { success: true, data }`, async () => {
      const req =
        endpoint.method === "post"
          ? request(app).post(endpoint.path)
          : request(app).get(endpoint.path);
      if (endpoint.body) {
        req.send(endpoint.body);
      }
      const res = await req;

      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(300);
      expect(res.body).toHaveProperty("success", true);
      expect(res.body).toHaveProperty("data");
    });
  }

  it("should have consistent envelope shape across all tested endpoints", async () => {
    const healthRes = await request(app).get("/api/v1/health");
    const agentsRes = await request(app).get("/api/v1/agents");

    expect(Object.keys(healthRes.body)).toContain("success");
    expect(Object.keys(healthRes.body)).toContain("data");
    expect(Object.keys(agentsRes.body)).toContain("success");
    expect(Object.keys(agentsRes.body)).toContain("data");
  });
});
