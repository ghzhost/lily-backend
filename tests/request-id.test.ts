import type { IncomingMessage } from "node:http";
import express from "express";
import request from "supertest";
import { describe, expect, it, vi } from "vitest";

import { createApp } from "../src/app";
import { AppError } from "../src/common/http/app-error";
import { errorHandler } from "../src/common/http/error.middleware";
import {
  getOrGenerateRequestId,
  requestIdMiddleware,
} from "../src/common/http/request-id.middleware";
import { logger } from "../src/config/logger";

describe("Request ID Middleware & Correlation (Issue #268)", () => {
  it("generates a valid UUID request ID if none is supplied", () => {
    const mockReq = { headers: {} } as unknown as IncomingMessage;
    const reqId = getOrGenerateRequestId(mockReq);
    expect(reqId).toBeDefined();
    expect(reqId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it("reuses incoming x-request-id header when provided", () => {
    const mockReq = { headers: { "x-request-id": "client-trace-12345" } } as unknown as IncomingMessage;
    const reqId = getOrGenerateRequestId(mockReq);
    expect(reqId).toBe("client-trace-12345");
  });

  it("attaches X-Request-Id header to 200 response in createApp", async () => {
    const app = createApp();
    const res = await request(app).get("/");
    expect(res.status).toBe(200);
    expect(res.headers["x-request-id"]).toBeDefined();
    expect(res.headers["x-request-id"]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it("echoes incoming X-Request-Id on response and keeps same ID across pino logging", async () => {
    const app = createApp();
    const customId = "trace-correlation-id-999";
    const res = await request(app).get("/").set("x-request-id", customId);
    expect(res.status).toBe(200);
    expect(res.headers["x-request-id"]).toBe(customId);
  });

  it("includes X-Request-Id header on 404 responses", async () => {
    const app = createApp();
    const res = await request(app).get("/api/v1/non-existent-path");
    expect(res.status).toBe(404);
    expect(res.headers["x-request-id"]).toBeDefined();
  });

  it("includes X-Request-Id header on 400 validation failure responses", async () => {
    const app = createApp();
    const res = await request(app).post("/api/v1/agents").send({});
    expect(res.status).toBe(400);
    expect(res.headers["x-request-id"]).toBeDefined();
  });

  it("correlates request ID in errorHandler log payload", async () => {
    const warnSpy = vi.spyOn(logger, "warn").mockImplementation(() => {});
    const app = express();
    app.use(requestIdMiddleware);
    app.get("/error-test", (_req, _res, next) => {
      next(new AppError(400, "Bad input error"));
    });
    app.use(errorHandler);

    const customId = "req-id-err-check-123";
    const res = await request(app).get("/error-test").set("x-request-id", customId);
    expect(res.status).toBe(400);
    expect(res.headers["x-request-id"]).toBe(customId);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        reqId: customId,
        statusCode: 400,
      }),
      "Request failed",
    );
    warnSpy.mockRestore();
  });
});
