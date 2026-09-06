import { performance } from "node:perf_hooks";
import type { NextFunction, Request, Response } from "express";

import { metricsService } from "./metrics.service";

export const metricsMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const start = performance.now();

  res.once("finish", () => {
    const durationMs = performance.now() - start;
    metricsService.recordRequest(req.method, res.statusCode, durationMs);
  });

  next();
};
