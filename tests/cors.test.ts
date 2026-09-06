import { describe, expect, it } from "vitest";

import { corsOptions } from "../src/config/cors";

const invokeOrigin = (origin: string | undefined) =>
  new Promise<{ error: Error | null; allowed: unknown }>((resolve) => {
    if (typeof corsOptions.origin !== "function") {
      resolve({ error: null, allowed: true });
      return;
    }

    corsOptions.origin(origin, (error, allow) => {
      resolve({ error, allowed: allow });
    });
  });

describe("CORS options handler", () => {
  it("allows non-browser requests with no origin", async () => {
    const { error, allowed } = await invokeOrigin(undefined);

    expect(error).toBeNull();
    expect(allowed).toBe(true);
  });

  it("allows configured whitelist origins", async () => {
    const { error, allowed } = await invokeOrigin("http://localhost:3000");

    expect(error).toBeNull();
    expect(allowed).toBe(true);
  });

  it("rejects unauthorized origins", async () => {
    const { error } = await invokeOrigin("https://malicious-site.com");

    expect(error).not.toBeNull();
    expect(error instanceof Error).toBe(true);
    expect((error as Error).message).toBe(
      "Origin is not allowed by CORS policy",
    );
  });
});
