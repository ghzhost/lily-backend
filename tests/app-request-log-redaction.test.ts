import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../src/app";

describe("app request log redaction (issue #272)", () => {
  let stdoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    stdoutSpy = vi
      .spyOn(process.stdout, "write")
      .mockImplementation(() => true);
  });

  afterEach(() => {
    stdoutSpy.mockRestore();
  });

  it("redacts app-level sensitive query keys through the shared serializer", async () => {
    const app = createApp();
    const server = app.listen(0);
    try {
      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("expected a port from app.listen(0)");
      }
      const port = address.port;

      const response = await fetch(
        `http://127.0.0.1:${port}/api/v1/agents?api_key=leak&client_secret=oops&safe=ok`,
      );
      // 404 is fine — the request still hits pino-http and is logged.
      expect(response.status).toBeGreaterThanOrEqual(200);
      // Drain body so the request completes.
      await response.text();

      const allOutput = stdoutSpy.mock.calls
        .map((call) => String(call[0] ?? ""))
        .join("");

      expect(allOutput).not.toContain("leak");
      expect(allOutput).not.toContain("oops");
      expect(allOutput).toContain("safe=ok");
      // [Redacted] is URL-encoded by serializeRequest/sanitizeRequestUrl as %5BRedacted%5D.
      expect(allOutput).toMatch(/%5BRedacted%5D/i);
      expect(allOutput).not.toMatch(/api_key=(?!%5BRedacted%5D)leak/i);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it("honors dash/underscore variants of sensitive keys via the shared serializer", async () => {
    const app = createApp();
    const server = app.listen(0);
    try {
      const address = server.address();
      if (!address || typeof address === "string") {
        throw new Error("expected a port from app.listen(0)");
      }
      const port = address.port;

      const response = await fetch(
        `http://127.0.0.1:${port}/api/v1/agents?wallet-seed=mnemonic-leak&Auth_Token=abc`,
      );
      expect(response.status).toBeGreaterThanOrEqual(200);
      await response.text();

      const allOutput = stdoutSpy.mock.calls
        .map((call) => String(call[0] ?? ""))
        .join("");

      expect(allOutput).not.toContain("mnemonic-leak");
      expect(allOutput).not.toContain("abc");
      expect(allOutput).toMatch(/%5BRedacted%5D/i);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
