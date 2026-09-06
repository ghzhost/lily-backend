import type { SerializedRequest, SerializedResponse } from "pino-std-serializers";
import { describe, expect, it } from "vitest";

import {
  sanitizeRequestUrl,
  serializeRequest,
  serializeResponse,
} from "../src/common/http/request-logger";

describe("request log sanitization", () => {
  it("redacts sensitive query values while preserving safe query context", () => {
    expect(
      sanitizeRequestUrl(
        "/api/v1/agents?owner=alice&api-key=secret-value&limit=10&token=abc",
      ),
    ).toBe(
      "/api/v1/agents?owner=alice&api-key=%5BRedacted%5D&limit=10&token=%5BRedacted%5D",
    );
  });

  it("omits headers, query objects, params, and raw request data", () => {
    const request = {
      id: "request-1",
      method: "GET",
      url: "/api/v1/agents?authorization=bearer-secret",
      headers: { authorization: "Bearer secret-value" },
      remoteAddress: "127.0.0.1",
      remotePort: 4000,
      params: {},
      query: { authorization: "bearer-secret" },
      raw: {},
    } as unknown as SerializedRequest;

    expect(serializeRequest(request)).toEqual({
      id: "request-1",
      method: "GET",
      url: "/api/v1/agents?authorization=%5BRedacted%5D",
      remoteAddress: "127.0.0.1",
      remotePort: 4000,
    });
    expect(serializeRequest(request)).not.toHaveProperty("headers");
    expect(serializeRequest(request)).not.toHaveProperty("query");
    expect(serializeRequest(request)).not.toHaveProperty("raw");
  });

  it("omits headers and raw properties from serialized response", () => {
    const response = {
      statusCode: 200,
      headers: {
        "content-security-policy": "default-src 'self'",
        "set-cookie": "session=secret",
      },
      raw: {},
    } as unknown as SerializedResponse;

    expect(serializeResponse(response)).toEqual({
      statusCode: 200,
    });
    expect(serializeResponse(response)).not.toHaveProperty("headers");
    expect(serializeResponse(response)).not.toHaveProperty("raw");
  });
});

