import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response, NextFunction } from "express";
import { apiKeyAuth } from "./api-key-auth.middleware";

vi.mock("../../config/env", () => ({
  securityConfig: {
    authApiKey: "test-secret-key-12345",
    authApiKeyHeader: "x-api-key",
  },
}));

vi.mock("../../config/logger", () => ({
  logger: { warn: vi.fn() },
}));

describe("apiKeyAuth constant-time comparison", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = { get: vi.fn() };
    res = {};
    next = vi.fn();
  });

  it("accepts matching key", () => {
    (req.get as any).mockReturnValue("test-secret-key-12345");
    apiKeyAuth(req as Request, res as Response, next);
    expect(next).toHaveBeenCalledWith();
    expect(next).not.toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  it("rejects wrong-length key with 403", () => {
    (req.get as any).mockReturnValue("short");
    apiKeyAuth(req as Request, res as Response, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  it("rejects near-miss key with 403", () => {
    (req.get as any).mockReturnValue("test-secret-key-12346");
    apiKeyAuth(req as Request, res as Response, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 403 }));
  });

  it("rejects missing key with 401", () => {
    (req.get as any).mockReturnValue(undefined);
    apiKeyAuth(req as Request, res as Response, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ statusCode: 401 }));
  });
});
