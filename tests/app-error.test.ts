import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "@/app";
import { AppError } from "@/common/http/app-error";

describe("AppError code property and error envelope (issue #259)", () => {
  const app = createApp();

  it("persists an error code on AppError constructor", () => {
    const error = new AppError(404, "Not found", undefined, "NOT_FOUND");
    expect(error.statusCode).toBe(404);
    expect(error.message).toBe("Not found");
    expect(error.code).toBe("NOT_FOUND");
  });

  it("emits code in error envelope for 404 routes", async () => {
    const response = await request(app).get("/api/v1/agents/unknown-id");
    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe("NOT_FOUND");
  });

  it("emits code in error envelope for 400 validation failures", async () => {
    const response = await request(app).post("/api/v1/agents").send({
      name: "X",
      description: "invalid",
      capabilities: [],
    });
    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe("VALIDATION_ERROR");
  });
});
