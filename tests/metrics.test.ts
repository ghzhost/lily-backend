import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../src/app";

describe("metrics endpoints", () => {
  const app = createApp();

  it("returns process metrics and telemetry data", async () => {
    const response = await request(app).get("/api/v1/metrics");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      uptimeSeconds: expect.any(Number),
      memoryUsage: {
        rssBytes: expect.any(Number),
        heapTotalBytes: expect.any(Number),
        heapUsedBytes: expect.any(Number),
        externalBytes: expect.any(Number),
      },
      eventLoopLagMs: expect.any(Number),
      nodeVersion: expect.stringMatching(/^v\d+/),
      environment: expect.any(String),
      timestamp: expect.any(String),
    });
    expect(response.body.data.eventLoopLagMs).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(response.body.data.eventLoopLagMs)).toBe(true);
  });
});
