import type { IncomingMessage } from "node:http";

import { describe, expect, it } from "vitest";

import {
  createRequestLogFilter,
  shouldIgnoreRequestLog,
} from "../src/config/request-logging";

const requestWithUrl = (url: string): IncomingMessage =>
  ({ url }) as IncomingMessage;

describe("request logging ignore rules", () => {
  describe("default API_PREFIX (/api/v1)", () => {
    it.each([
      "/",
      "/?probe=1",
      "/api/v1/health",
      "/api/v1/health/",
      "/api/v1/health/live",
      "/api/v1/health/ready",
      "/api/v1/health?probe=1",
      "/api/v1/metrics",
      "/api/v1/metrics/",
      "/api/v1/metrics?probe=1",
    ])("ignores %s", (url) => {
      expect(shouldIgnoreRequestLog(requestWithUrl(url))).toBe(true);
    });

    it.each([
      "/api/v1/agents",
      "/api/v1/payments",
      "/api/v1/healthy",
      "/health",
      "/metrics",
    ])("keeps %s in request logs", (url) => {
      expect(shouldIgnoreRequestLog(requestWithUrl(url))).toBe(false);
    });
  });

  describe("custom API_PREFIX (/api/v2)", () => {
    const customFilter = createRequestLogFilter("/api/v2");

    it.each([
      "/",
      "/?probe=1",
      "/api/v2/health",
      "/api/v2/health/",
      "/api/v2/health/live",
      "/api/v2/health/ready",
      "/api/v2/health?probe=1",
      "/api/v2/metrics",
      "/api/v2/metrics/",
      "/api/v2/metrics?probe=1",
    ])("ignores %s with custom prefix", (url) => {
      expect(customFilter(requestWithUrl(url))).toBe(true);
      expect(shouldIgnoreRequestLog(requestWithUrl(url), "/api/v2")).toBe(true);
    });

    it.each([
      "/api/v2/agents",
      "/api/v2/payments",
      "/api/v2/healthy",
      "/api/v1/health",
      "/api/v1/metrics",
      "/health",
      "/metrics",
    ])("keeps %s in request logs with custom prefix", (url) => {
      expect(customFilter(requestWithUrl(url))).toBe(false);
      expect(shouldIgnoreRequestLog(requestWithUrl(url), "/api/v2")).toBe(
        false,
      );
    });
  });
});
