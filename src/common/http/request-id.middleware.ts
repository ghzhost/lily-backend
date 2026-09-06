import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { NextFunction, Request, Response } from "express";

export const REQUEST_ID_HEADER = "x-request-id";

export const getOrGenerateRequestId = (req: IncomingMessage): string => {
  const headerValue = req.headers[REQUEST_ID_HEADER];
  if (typeof headerValue === "string" && headerValue.trim().length > 0) {
    return headerValue.trim();
  }
  if (
    Array.isArray(headerValue) &&
    headerValue.length > 0 &&
    typeof headerValue[0] === "string" &&
    headerValue[0].trim().length > 0
  ) {
    return headerValue[0].trim();
  }
  return randomUUID();
};

export const requestIdMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const reqId = (req.id as string) || getOrGenerateRequestId(req);
  req.id = reqId;
  res.setHeader(REQUEST_ID_HEADER, reqId);
  next();
};
