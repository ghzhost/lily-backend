import { timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

import { securityConfig } from "../../config/env";
import { logger } from "../../config/logger";
import { AppError } from "./app-error";

let warnedAboutMissingKey = false;

export function apiKeyAuth(request: Request, _response: Response, next: NextFunction): void {
  if (!securityConfig.authApiKey) {
    if (!warnedAboutMissingKey) {
      warnedAboutMissingKey = true;
      logger.warn("AUTH_API_KEY is not set — API key authentication is disabled");
    }
    return next();
  }

  const headerName = securityConfig.authApiKeyHeader;
  const providedKey = request.get(headerName);

  if (!providedKey) {
    return next(new AppError(401, "API key is required"));
  }

  const providedBuffer = Buffer.from(providedKey);
  const expectedBuffer = Buffer.from(securityConfig.authApiKey);

  if (
    providedBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(providedBuffer, expectedBuffer)
  ) {
    return next(new AppError(403, "Invalid API key"));
  }

  return next();
}
