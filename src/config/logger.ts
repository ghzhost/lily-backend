import pino, { type LoggerOptions } from "pino";

import { env } from "./env";

const loggerOptions: LoggerOptions = {
  name: env.APP_NAME,
  level: env.LOG_LEVEL,
};

// In development, pretty-print logs through the pino transport. All other
// environments stream through process.stdout so that stdout-based
// instrumentation (e.g. the redaction integration test) can observe output.
export const logger =
  env.NODE_ENV === "development"
    ? pino({
        ...loggerOptions,
        transport: {
          target: "pino-pretty",
          options: {
            colorize: true,
            translateTime: "SYS:standard",
          },
        },
      })
    : pino(loggerOptions, process.stdout);
