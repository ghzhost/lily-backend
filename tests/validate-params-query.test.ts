import { describe, it, expect } from "vitest";
import express from "express";
import type { Request } from "express";
import request from "supertest";
import { z } from "zod";
import {
  validateParams,
  validateQuery,
} from "../src/common/http/validate.middleware";
import { errorHandler } from "../src/common/http/error.middleware";

describe("validateParams and validateQuery helpers (issue #86)", () => {
  const createAppWithValidation = () => {
    const app = express();

    app.get(
      "/items/:id",
      validateParams(z.object({ id: z.string().uuid() })),
      (req, res) => {
        res.json({ success: true, data: { id: req.params.id } });
      },
    );

    app.get(
      "/search",
      validateQuery(
        z.object({
          q: z.string().min(1),
          limit: z.coerce.number().int().positive().optional(),
        }),
      ),
      (req, res) => {
        const vq = (
          req as Request & { validatedQuery?: { q: string; limit?: number } }
        ).validatedQuery!;
        res.json({ success: true, data: { q: vq.q, limit: vq.limit } });
      },
    );

    app.use(errorHandler);
    return app;
  };

  it("should accept valid params and replace req.params with parsed data", async () => {
    const id = "550e8400-e29b-41d4-a716-446655440000";
    const app = createAppWithValidation();
    const res = await request(app).get(`/items/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(id);
  });

  it("should reject invalid params with 400 envelope", async () => {
    const app = createAppWithValidation();
    const res = await request(app).get("/items/not-a-uuid");
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Request validation failed");
  });

  it("should accept valid query and coerce types", async () => {
    const app = createAppWithValidation();
    const res = await request(app).get("/search?q=test&limit=10");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.q).toBe("test");
    expect(res.body.data.limit).toBe(10);
    expect(typeof res.body.data.limit).toBe("number");
  });

  it("should reject missing required query params with 400", async () => {
    const app = createAppWithValidation();
    const res = await request(app).get("/search");
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("should reject invalid coerced query values with 400", async () => {
    const app = createAppWithValidation();
    const res = await request(app).get("/search?q=test&limit=-5");
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
