import type { IncomingMessage } from "node:http";

import { env } from "./env";

export const createRequestLogFilter = (
  apiPrefix: string = env.API_PREFIX,
): ((request: IncomingMessage) => boolean) => {
  const normalizedPrefix = apiPrefix.replace(/\/+$/, "");
  const healthPath = `${normalizedPrefix}/health`;
  const metricsPath = `${normalizedPrefix}/metrics`;

  return (request: IncomingMessage): boolean => {
    const pathname = new URL(request.url ?? "/", "http://localhost").pathname;

    return (
      pathname === "/" ||
      pathname === healthPath ||
      pathname.startsWith(`${healthPath}/`) ||
      pathname === metricsPath ||
      pathname.startsWith(`${metricsPath}/`)
    );
  };
};

export const shouldIgnoreRequestLog = (
  request: IncomingMessage,
  apiPrefix: string = env.API_PREFIX,
): boolean => {
  return createRequestLogFilter(apiPrefix)(request);
};
