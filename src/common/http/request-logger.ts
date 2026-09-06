import type { ServerResponse } from "node:http";
import type { SerializedRequest, SerializedResponse } from "pino-std-serializers";

const REDACTED = "[Redacted]";

const sensitiveQueryKeys = new Set([
  "access_token",
  "api_key",
  "apikey",
  "auth_token",
  "authorization",
  "client_secret",
  "cookie",
  "credential",
  "key",
  "password",
  "private_key",
  "refresh_token",
  "secret",
  "session",
  "signature",
  "sig",
  "token",
  "wallet_seed",
]);

const normalizeQueryKey = (key: string) => key.toLowerCase().replace(/-/g, "_");

export const sanitizeRequestUrl = (requestUrl: string) => {
  const [pathname, query = ""] = requestUrl.split("?", 2);

  if (!query) {
    return pathname;
  }

  const params = new URLSearchParams(query);
  const sanitizedParams = new URLSearchParams();

  for (const [key, value] of params) {
    sanitizedParams.append(
      key,
      sensitiveQueryKeys.has(normalizeQueryKey(key)) ? REDACTED : value,
    );
  }

  return `${pathname}?${sanitizedParams.toString()}`;
};

export const serializeRequest = (request: SerializedRequest) => ({
  id: request.id,
  method: request.method,
  url: sanitizeRequestUrl(request.url),
  remoteAddress: request.remoteAddress,
  remotePort: request.remotePort,
});

export const serializeResponse = (
  response: SerializedResponse | ServerResponse | { statusCode?: number },
) => ({
  statusCode: response.statusCode,
});

