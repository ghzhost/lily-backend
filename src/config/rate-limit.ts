import type { Request, Response } from "express";
import rateLimit from "express-rate-limit";

import { env, securityConfig } from "./env";

interface RateLimitLocals {
  resetTime?: Date | null;
}

/**
 * Normalizes and determines whether a given path is an operational endpoint
 * (root, health probes, or metrics) that should not consume the public rate limit.
 */
export const isOperationalPath = (
  pathname: string,
  apiPrefix: string = env.API_PREFIX,
): boolean => {
  const normalized = pathname.split("?")[0] ?? "";
  const healthPrefix = `${apiPrefix}/health`;
  const metricsPrefix = `${apiPrefix}/metrics`;

  return (
    normalized === "/" ||
    normalized === healthPrefix ||
    normalized.startsWith(`${healthPrefix}/`) ||
    normalized === metricsPrefix ||
    normalized.startsWith(`${metricsPrefix}/`) ||
    normalized === "/health" ||
    normalized.startsWith("/health/") ||
    normalized === "/metrics" ||
    normalized.startsWith("/metrics/")
  );
};

/**
 * Predicate evaluating whether an incoming request should skip the API rate limiter.
 */
export const shouldSkipApiRateLimit = (
  request: Request,
  apiPrefix: string = env.API_PREFIX,
): boolean => {
  const isTest = process.env.NODE_ENV === "test";
  const forceRateLimit =
    process.env.ENABLE_RATE_LIMIT_TESTS === "true" ||
    request.headers?.["x-test-rate-limit"] === "true";

  if (isTest && !forceRateLimit) {
    return true;
  }

  if (request.path && isOperationalPath(request.path, apiPrefix)) {
    return true;
  }

  if (request.originalUrl) {
    const originalPathname = new URL(request.originalUrl, "http://localhost")
      .pathname;
    if (isOperationalPath(originalPathname, apiPrefix)) {
      return true;
    }
  }

  if (request.url) {
    const urlPathname = new URL(request.url, "http://localhost").pathname;
    if (isOperationalPath(urlPathname, apiPrefix)) {
      return true;
    }
  }

  return false;
};

/**
 * Custom 429 handler used when an express-rate-limit limiter is exceeded.
 * Reads the limiter-provided reset time from `res.locals.rateLimit` so the
 * Retry-After header and the response envelope reflect when the window resets.
 */
export const rateLimitHandler = (
  _request: Request,
  response: Response,
): void => {
  const resetTime =
    (response.locals as { rateLimit?: RateLimitLocals }).rateLimit?.resetTime ??
    null;

  if (resetTime && resetTime.getTime() > Date.now()) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((resetTime.getTime() - Date.now()) / 1000),
    );
    response.setHeader("Retry-After", String(retryAfterSeconds));
  }

  response.status(429).json({
    success: false,
    message: "Too many requests, please try again later.",
    details: { resetTime: resetTime ? resetTime.toISOString() : null },
  });
};

export interface CreateRateLimiterOptions {
  apiPrefix?: string;
  limit?: number;
  windowMs?: number;
}

export const createApiRateLimiter = (options?: CreateRateLimiterOptions) => {
  return rateLimit({
    windowMs: options?.windowMs ?? securityConfig.rateLimitWindowMs,
    limit: options?.limit ?? securityConfig.rateLimitMaxRequests,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (request: Request) =>
      shouldSkipApiRateLimit(request, options?.apiPrefix ?? env.API_PREFIX),
    handler: rateLimitHandler,
  });
};

export const apiRateLimiter = createApiRateLimiter();

export const writeRateLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV === "test" || isOperationalPath(req),
  handler: rateLimitHandler,
});
