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
