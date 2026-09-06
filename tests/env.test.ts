import { afterEach, describe, expect, it, vi } from "vitest";

const resetEnv = () => {
  vi.resetModules();
  vi.unstubAllEnvs();
};

describe("env schema", () => {
  afterEach(() => {
    resetEnv();
  });

  it("applies defaults for PORT, APP_NAME, and API_PREFIX when unset", async () => {
    vi.stubEnv("NODE_ENV", "test");
    const { env } = await import("../src/config/env");

    expect(env.PORT).toBe(4000);
    expect(env.APP_NAME).toBe("Lily Backend");
    expect(env.API_PREFIX).toBe("/api/v1");
    expect(env.AUTH_API_KEY_HEADER).toBe("x-api-key");
  });

  it("coerces PORT string to number within valid range", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("PORT", "8080");
    const { env } = await import("../src/config/env");

    expect(env.PORT).toBe(8080);
    expect(typeof env.PORT).toBe("number");
  });

  it("rejects invalid NODE_ENV values", async () => {
    vi.stubEnv("NODE_ENV", "staging");
    await expect(() => import("../src/config/env")).rejects.toThrow(
      /Invalid environment configuration/,
    );
  });

  it("rejects invalid LOG_LEVEL values", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("LOG_LEVEL", "verbose");
    await expect(() => import("../src/config/env")).rejects.toThrow(
      /Invalid environment configuration/,
    );
  });

  it("transforms TRUST_PROXY numeric hop count string to a number", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("TRUST_PROXY", "1");
    const { env } = await import("../src/config/env");

    expect(env.TRUST_PROXY).toBe(1);
    expect(typeof env.TRUST_PROXY).toBe("number");
  });

  it("transforms TRUST_PROXY string 'false' to boolean false", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("TRUST_PROXY", "false");
    const { env } = await import("../src/config/env");

    expect(env.TRUST_PROXY).toBe(false);
  });

  it("rejects unsafe TRUST_PROXY value 'true'", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("TRUST_PROXY", "true");
    await expect(() => import("../src/config/env")).rejects.toThrow(
      /Invalid environment configuration/,
    );
  });

  it("validates RATE_LIMIT_MAX_REQUESTS as positive integer", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("RATE_LIMIT_MAX_REQUESTS", "0");
    await expect(() => import("../src/config/env")).rejects.toThrow(
      /Invalid environment configuration/,
    );
  });

  it("accepts the default and ordinary API key header names", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("AUTH_API_KEY_HEADER", "x-auth-key");

    const { env } = await import("../src/config/env");

    expect(env.AUTH_API_KEY_HEADER).toBe("x-auth-key");
  });

  it.each(["my header", " x-api-key", "x-api-key ", "x-api:key", ""])(
    "rejects malformed API key header name %j before startup",
    async (header) => {
      vi.stubEnv("NODE_ENV", "test");
      vi.stubEnv("AUTH_API_KEY_HEADER", header);

      await expect(() => import("../src/config/env")).rejects.toThrow(
        /Invalid environment configuration/,
      );
    },
  );

  it.each(["authorization", "Cookie", "idempotency-key", "X-Request-Id"])(
    "rejects reserved API key header name %j before startup",
    async (header) => {
      vi.stubEnv("NODE_ENV", "test");
      vi.stubEnv("AUTH_API_KEY_HEADER", header);

      await expect(() => import("../src/config/env")).rejects.toThrow(
        /Invalid environment configuration/,
      );
    },
  );
});
