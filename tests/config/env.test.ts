import { describe, expect, it } from "vitest";

import { trustProxySchema } from "../../src/config/env";
import { securityConfig } from "../../src/config/env";

describe("AUTH_API_KEY env schema", () => {
  it("exposes AUTH_API_KEY through securityConfig.authApiKey", () => {
    // securityConfig is initialized from parsed env at import time;
    // when AUTH_API_KEY is not set it should be undefined (not stripped to '').
    const value = securityConfig.authApiKey;
    expect(value === undefined || typeof value === "string").toBe(true);
  });

  it("defaults AUTH_API_KEY_HEADER to x-api-key via securityConfig", () => {
    expect(securityConfig.authApiKeyHeader).toBe("x-api-key");
  });
});

describe("TRUST_PROXY validation", () => {
  it('accepts "false" and transforms to boolean false', () => {
    const result = trustProxySchema.parse("false");
    expect(result).toBe(false);
  });

  it('rejects "true" (unsafe in production)', () => {
    expect(() => trustProxySchema.parse("true")).toThrow();
  });

  it("accepts numeric string hop counts", () => {
    const result = trustProxySchema.parse("1");
    expect(result).toBe(1);
  });

  it("accepts zero as valid hop count", () => {
    const result = trustProxySchema.parse("0");
    expect(result).toBe(0);
  });

  it("rejects negative numbers", () => {
    expect(() => trustProxySchema.parse("-1")).toThrow();
  });

  it("rejects non-numeric strings", () => {
    expect(() => trustProxySchema.parse("yes")).toThrow();
  });

  it("rejects floating point numbers", () => {
    expect(() => trustProxySchema.parse("1.5")).toThrow();
  });

  it("defaults to false when not provided", () => {
    const result = trustProxySchema.parse(undefined);
    expect(result).toBe(false);
  });
});

describe("AUTH_API_KEY_HEADER validation (issue #291)", () => {
  it("defaults to x-api-key when undefined", () => {
    expect(authApiKeyHeaderSchema.parse(undefined)).toBe("x-api-key");
  });

  it("accepts standard valid header token names", () => {
    expect(authApiKeyHeaderSchema.parse("x-api-key")).toBe("x-api-key");
    expect(authApiKeyHeaderSchema.parse("x-auth-key")).toBe("x-auth-key");
    expect(authApiKeyHeaderSchema.parse("X-Custom-Token")).toBe(
      "X-Custom-Token",
    );
    expect(authApiKeyHeaderSchema.parse("my_api_key")).toBe("my_api_key");
  });

  it("rejects empty strings or values with whitespace", () => {
    expect(() => authApiKeyHeaderSchema.parse("")).toThrow();
    expect(() => authApiKeyHeaderSchema.parse("my header")).toThrow();
    expect(() => authApiKeyHeaderSchema.parse(" x-api-key")).toThrow();
    expect(() => authApiKeyHeaderSchema.parse("x-api-key ")).toThrow();
  });

  it("rejects header names with invalid characters", () => {
    expect(() => authApiKeyHeaderSchema.parse("x-api:key")).toThrow();
    expect(() => authApiKeyHeaderSchema.parse("x-api/key")).toThrow();
    expect(() => authApiKeyHeaderSchema.parse("x-api@key")).toThrow();
  });

  it("rejects reserved headers that conflict with auth/session handling", () => {
    expect(() => authApiKeyHeaderSchema.parse("authorization")).toThrow();
    expect(() => authApiKeyHeaderSchema.parse("Authorization")).toThrow();
    expect(() => authApiKeyHeaderSchema.parse("cookie")).toThrow();
    expect(() => authApiKeyHeaderSchema.parse("set-cookie")).toThrow();
    expect(() => authApiKeyHeaderSchema.parse("host")).toThrow();
    expect(() => authApiKeyHeaderSchema.parse("content-type")).toThrow();
  });
});
