import type { Request, Response } from "express";
import { describe, expect, it, vi } from "vitest";

import { asyncHandler } from "../src/common/http/async-handler";

describe("asyncHandler generic type preservation and error forwarding (issue #296)", () => {
  it("forwards rejected promises to next()", async () => {
    const error = new Error("Async failure");
    const handler = asyncHandler(async () => {
      throw error;
    });

    const next = vi.fn();
    handler({} as Request, {} as Response, next);

    // Wait for the promise microtask to resolve
    await Promise.resolve();

    expect(next).toHaveBeenCalledWith(error);
  });

  it("calls next with nothing on success", async () => {
    const handler = asyncHandler(async (_req, res) => {
      res.status(200);
    });

    const next = vi.fn();
    const res = { status: vi.fn() } as unknown as Response;

    handler({} as Request, res, next);
    await Promise.resolve();

    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  it("preserves generic type parameters on Request and Response", async () => {
    interface SpecificBody {
      validField: string;
    }

    interface SpecificParams {
      paramId: string;
    }

    const handler = asyncHandler(
      async (req: Request<SpecificParams, unknown, SpecificBody>) => {
        // Correctly typed access
        const field: string = req.body.validField;
        const id: string = req.params.paramId;

        // @ts-expect-error - Deliberately accessing invalid property must fail typecheck
        void req.body.nonExistentField;

        // @ts-expect-error - Deliberately accessing invalid param must fail typecheck
        void req.params.nonExistentParam;

        expect(typeof field).toBeDefined();
        expect(typeof id).toBeDefined();
      },
    );

    expect(typeof handler).toBe("function");
  });
});
