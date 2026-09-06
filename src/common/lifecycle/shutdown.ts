import type { Server } from "node:http";
import type { Logger } from "pino";

export interface ShutdownOptions {
  server: Server;
  logger: Logger;
  /**
   * A process-like object so tests can drive signal and error lifecycle
   * events (and observe exit calls) without touching the real process.
   */
  processLike: NodeJS.Process;
  /** How long to wait for connections to drain before forcing exit(1). */
  forceExitTimeoutMs?: number;
}

/**
 * Builds an idempotent graceful-shutdown handler for the HTTP server:
 * the first invocation starts draining (closing idle connections first),
 * and any later invocation is ignored. If draining does not finish within
 * `forceExitTimeoutMs`, the process exits with code 1; a successful close
 * exits with code 0; a close error exits with code 1.
 */
export const createShutdownHandler = ({
  server,
  logger,
  processLike,
  forceExitTimeoutMs = 10_000,
}: ShutdownOptions): ((signal: string) => void) => {
  let isShuttingDown = false;

  return (signal: string): void => {
    if (isShuttingDown) {
      return;
    }
    isShuttingDown = true;

    logger.info({ signal }, "Graceful shutdown started");

    const forceTimeout = setTimeout(() => {
      logger.error("Graceful shutdown timed out, forcing process exit");
      processLike.exit(1);
    }, forceExitTimeoutMs);
    forceTimeout.unref?.();

    // Close idle connections to speed up draining
    if (typeof server.closeIdleConnections === "function") {
      server.closeIdleConnections();
    }

    server.close((error) => {
      clearTimeout(forceTimeout);
      if (error) {
        logger.error({ err: error }, "Error while shutting down server");
        processLike.exit(1);
        return;
      }

      logger.info("HTTP server closed");
      processLike.exit(0);
    });
  };
};

/**
 * Wires SIGINT/SIGTERM and fatal process errors (unhandledRejection,
 * uncaughtException) to a single shared shutdown handler.
 */
export const registerProcessLifecycle = (options: ShutdownOptions): void => {
  const shutdown = createShutdownHandler(options);
  const { processLike, logger } = options;

  processLike.on("SIGINT", () => shutdown("SIGINT"));
  processLike.on("SIGTERM", () => shutdown("SIGTERM"));

  processLike.on("unhandledRejection", (reason: unknown) => {
    logger.fatal({ err: reason }, "Unhandled Promise Rejection detected");
    shutdown("unhandledRejection");
  });

  processLike.on("uncaughtException", (error: Error) => {
    logger.fatal({ err: error }, "Uncaught Exception detected");
    shutdown("uncaughtException");
  });
};
