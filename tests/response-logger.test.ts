import http from "node:http";
import type { SerializedResponse } from "pino-std-serializers";
import pino from "pino";
import pinoHttp from "pino-http";
import { describe, expect, it } from "vitest";

import { serializeResponse } from "../src/common/http/request-logger";

describe("pino-http response log serialization", () => {
  it("omits headers from serialized response", () => {
    const rawRes = {
      statusCode: 200,
      headers: {
        "content-type": "application/json",
        "content-security-policy": "default-src 'self'",
        "x-frame-options": "SAMEORIGIN",
      },
    } as unknown as SerializedResponse;

    const serialized = serializeResponse(rawRes);
    expect(serialized).toEqual({ statusCode: 200 });
    expect(serialized).not.toHaveProperty("headers");
  });

  it("works with pino-http instance serializer options in real request cycle", async () => {
    let capturedLog: Record<string, unknown> | null = null;
    const testLogger = pino(
      { level: "info" },
      {
        write: (msg: string) => {
          try {
            capturedLog = JSON.parse(msg) as Record<string, unknown>;
          } catch {
            // ignore
          }
        },
      },
    );

    const httpLogger = pinoHttp({
      logger: testLogger,
      serializers: {
        res: serializeResponse as never,
      },
    });

    const server = http.createServer((req, res) => {
      httpLogger(req, res);
      res.setHeader("Content-Type", "application/json");
      res.setHeader("X-Custom-Secret-Header", "secret");
      res.statusCode = 200;
      res.end(JSON.stringify({ ok: true }));
    });

    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => {
        const port = (server.address() as { port: number }).port;
        http.get(`http://127.0.0.1:${port}`, () => {
          setTimeout(() => {
            server.close(() => resolve());
          }, 50);
        });
      });
    });

    expect(capturedLog).toBeDefined();
    const logObj = capturedLog as unknown as { res?: { headers?: unknown; statusCode?: number } };
    expect(logObj?.res?.statusCode).toBe(200);
    expect(logObj?.res?.headers).toBeUndefined();
  });
});
