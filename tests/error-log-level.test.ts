import express from "express";
import request from "supertest";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

import { AppError } from "../src/common/http/app-error";
import { errorHandler } from "../src/common/http/error.middleware";
import { createApp } from "../src/app";
import { logger } from "../src/config/logger";
import { apiRouter } from "../src/routes";

const createErrorApp = (error: Error) => {
  const app = express();

  app.get("/error", (_request, _response, next) => {
    next(error);
  });
  app.use(errorHandler);

  return app;
};

describe("error handler log levels", () => {
  describe("isolated error handler", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it.each([400, 404, 429])(
      "logs %s responses at warn level",
      async (statusCode) => {
        const warn = vi.spyOn(logger, "warn").mockImplementation(() => logger);
        const error = vi
          .spyOn(logger, "error")
          .mockImplementation(() => logger);

        const response = await request(
          createErrorApp(new AppError(statusCode, "Client request failed")),
        ).get("/error");

        expect(response.status).toBe(statusCode);
        expect(warn).toHaveBeenCalledOnce();
        expect(error).not.toHaveBeenCalled();
      },
    );

    it("logs 500 responses at error level", async () => {
      const warn = vi.spyOn(logger, "warn").mockImplementation(() => logger);
      const error = vi.spyOn(logger, "error").mockImplementation(() => logger);

      const response = await request(
        createErrorApp(new Error("Server failure")),
      ).get("/error");

      expect(response.status).toBe(500);
      expect(error).toHaveBeenCalledOnce();
      expect(warn).not.toHaveBeenCalled();
    });
  });

  describe("full app with pino-http mounted", () => {
    const app = createApp();

    beforeAll(() => {
      apiRouter.get("/test-error-400", (_request, _response, next) => {
        next(new AppError(400, "Client request failed"));
      });
      apiRouter.get("/test-error-429", (_request, _response, next) => {
        next(new AppError(429, "Rate limit exceeded"));
      });
      apiRouter.get("/test-error-500", (_request, _response, next) => {
        next(new Error("Server failure"));
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it.each([
      [400, "/api/v1/test-error-400"],
      [404, "/api/v1/non-existent-route"],
      [429, "/api/v1/test-error-429"],
    ])(
      "emits a single warn log line containing error context for %s responses",
      async (statusCode, path) => {
        const warn = vi.spyOn(logger, "warn").mockImplementation(() => logger);
        const error = vi
          .spyOn(logger, "error")
          .mockImplementation(() => logger);
        const info = vi.spyOn(logger, "info").mockImplementation(() => logger);

        const response = await request(app).get(path);

        expect(response.status).toBe(statusCode);
        expect(warn).toHaveBeenCalledOnce();
        expect(error).not.toHaveBeenCalled();
        expect(warn).toHaveBeenCalledWith(
          expect.objectContaining({
            statusCode,
            err: expect.anything(),
            method: "GET",
          }),
          "Request failed",
        );
        expect(info).toHaveBeenCalled();
      },
    );

    it("emits a single error log line containing error context for 500 responses", async () => {
      const warn = vi.spyOn(logger, "warn").mockImplementation(() => logger);
      const error = vi.spyOn(logger, "error").mockImplementation(() => logger);
      const info = vi.spyOn(logger, "info").mockImplementation(() => logger);

      const response = await request(app).get("/api/v1/test-error-500");

      expect(response.status).toBe(500);
      expect(error).toHaveBeenCalledOnce();
      expect(warn).not.toHaveBeenCalled();
      expect(error).toHaveBeenCalledWith(
        expect.objectContaining({
          statusCode: 500,
          err: expect.anything(),
          method: "GET",
        }),
        "Request failed",
      );
      expect(info).toHaveBeenCalled();
    });

    it("preserves normal 2xx access logging without emitting warn or error lines", async () => {
      const warn = vi.spyOn(logger, "warn").mockImplementation(() => logger);
      const error = vi.spyOn(logger, "error").mockImplementation(() => logger);
      const info = vi.spyOn(logger, "info").mockImplementation(() => logger);

      const response = await request(app).get("/api/v1/metrics");

      expect(response.status).toBe(200);
      expect(warn).not.toHaveBeenCalled();
      expect(error).not.toHaveBeenCalled();
      expect(info).toHaveBeenCalled();
    });
  });
});
