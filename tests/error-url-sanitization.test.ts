import { describe, expect, it, vi } from "vitest";
import request from "supertest";

import { createApp } from "../src/app";
import { logger } from "../src/config/logger";

describe("error and 404 URL sanitization (issue #282)", () => {
  const app = createApp();

  it("produces a 404 response message that strips query parameters completely", async () => {
    const res = await request(app).get(
      "/api/v1/unknown-endpoint?api_key=secret&seed=my-wallet-seed",
    );

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe(
      "Route not found: GET /api/v1/unknown-endpoint",
    );
    expect(res.body.message).not.toContain("api_key");
    expect(res.body.message).not.toContain("seed");
    expect(res.body.message).not.toContain("secret");
  });

  it("sanitizes request path in structured error log so secrets never leak", async () => {
    const warnSpy = vi.spyOn(logger, "warn");

    await request(app).get(
      "/api/v1/unknown-route?api_key=secret123&seed=my-wallet-seed456&public=safe",
    );

    expect(warnSpy).toHaveBeenCalled();
    const logCall = warnSpy.mock.calls.find(
      (call) =>
        typeof call[0] === "object" && call[0] !== null && "path" in call[0],
    );

    expect(logCall).toBeDefined();
    const loggedPath = (logCall?.[0] as { path?: string })?.path ?? "";

    expect(loggedPath).not.toContain("secret123");
    expect(loggedPath).not.toContain("my-wallet-seed456");
    expect(loggedPath).toContain("public=safe");
    expect(loggedPath).toContain("%5BRedacted%5D");

    warnSpy.mockRestore();
  });
});
