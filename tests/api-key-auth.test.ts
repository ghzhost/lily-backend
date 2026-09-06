import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import request from "supertest";


const TEST_KEY = "test-secret-key-12345";

describe("API key authentication middleware (issue #81)", () => {
  let originalKey: string | undefined;
  let originalHeader: string | undefined;

  beforeEach(() => {
    originalKey = process.env.AUTH_API_KEY;
    originalHeader = process.env.AUTH_API_KEY_HEADER;
    process.env.AUTH_API_KEY = TEST_KEY;
    delete process.env.AUTH_API_KEY_HEADER;
    vi.resetModules();
  });

  afterEach(() => {
    if (originalKey !== undefined) {
      process.env.AUTH_API_KEY = originalKey;
    } else {
      delete process.env.AUTH_API_KEY;
    }
    if (originalHeader !== undefined) {
      process.env.AUTH_API_KEY_HEADER = originalHeader;
    } else {
      delete process.env.AUTH_API_KEY_HEADER;
    }
  });

  it("returns 401 when no API key is provided", async () => {
    const { createApp: create } = await import("../src/app");
    const app = create();

    const res = await request(app).get("/api/v1/agents");

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain("API key");
  });

  it("returns 403 when an invalid API key is provided", async () => {
    const { createApp: create } = await import("../src/app");
    const app = create();

    const res = await request(app)
      .get("/api/v1/agents")
      .set("x-api-key", "wrong-key");

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain("Invalid");
  });

  it("returns 200 when the correct API key is provided", async () => {
    const { createApp: create } = await import("../src/app");
    const app = create();

    const res = await request(app)
      .get("/api/v1/agents")
      .set("x-api-key", TEST_KEY);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("keeps /health public without requiring an API key", async () => {
    const { createApp: create } = await import("../src/app");
    const app = create();

    const res = await request(app).get("/api/v1/health");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("disables auth with a warning when AUTH_API_KEY is not set", async () => {
    delete process.env.AUTH_API_KEY;
    const { createApp: create } = await import("../src/app");
    const app = create();

    const res = await request(app).get("/api/v1/agents");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("supports a custom header name via AUTH_API_KEY_HEADER", async () => {
    process.env.AUTH_API_KEY_HEADER = "x-custom-auth";
    const { createApp: create } = await import("../src/app");
    const app = create();

    const resWrongHeader = await request(app)
      .get("/api/v1/agents")
      .set("x-api-key", TEST_KEY);

    expect(resWrongHeader.status).toBe(401);

    const resCorrectHeader = await request(app)
      .get("/api/v1/agents")
      .set("x-custom-auth", TEST_KEY);

    expect(resCorrectHeader.status).toBe(200);
  });

  it("rejects keys of unequal length without throwing RangeError (issue #287)", async () => {
    const { createApp: create } = await import("../src/app");
    const app = create();

    // Shorter key
    const resShort = await request(app)
      .get("/api/v1/agents")
      .set("x-api-key", "short");
    expect(resShort.status).toBe(403);
    expect(resShort.body.message).toContain("Invalid API key");

    // Longer key
    const resLong = await request(app)
      .get("/api/v1/agents")
      .set("x-api-key", `${TEST_KEY}-too-long`);
    expect(resLong.status).toBe(403);
    expect(resLong.body.message).toContain("Invalid API key");
  });

  it("rejects near-miss keys of identical length in constant time (issue #287)", async () => {
    const { createApp: create } = await import("../src/app");
    const app = create();

    // Differing only at the final character
    const lastCharDiff = TEST_KEY.slice(0, -1) + (TEST_KEY.slice(-1) === "0" ? "1" : "0");
    const resLast = await request(app)
      .get("/api/v1/agents")
      .set("x-api-key", lastCharDiff);
    expect(resLast.status).toBe(403);

    // Differing only at the first character
    const firstCharDiff = (TEST_KEY[0] === "a" ? "b" : "a") + TEST_KEY.slice(1);
    const resFirst = await request(app)
      .get("/api/v1/agents")
      .set("x-api-key", firstCharDiff);
    expect(resFirst.status).toBe(403);

    // Differing only in the middle
    const mid = Math.floor(TEST_KEY.length / 2);
    const midDiff =
      TEST_KEY.slice(0, mid) + (TEST_KEY[mid] === "x" ? "y" : "x") + TEST_KEY.slice(mid + 1);
    const resMid = await request(app)
      .get("/api/v1/agents")
      .set("x-api-key", midDiff);
    expect(resMid.status).toBe(403);
  });
});
