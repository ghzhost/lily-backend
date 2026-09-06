import type { Server } from "node:http";
import { EventEmitter } from "node:events";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createShutdownHandler,
  registerProcessLifecycle,
  type ShutdownOptions,
} from "../src/common/lifecycle/shutdown";

interface Harness {
  options: ShutdownOptions;
  logger: {
    info: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    fatal: ReturnType<typeof vi.fn>;
  };
  processLike: EventEmitter & { exit: ReturnType<typeof vi.fn> };
  server: {
    close: ReturnType<typeof vi.fn>;
    closeIdleConnections: ReturnType<typeof vi.fn>;
  };
}

const createHarness = (): Harness => {
  const logger = {
    info: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
  };

  const processLike = Object.assign(new EventEmitter(), {
    exit: vi.fn(),
  }) as unknown as Harness["processLike"];

  const server = {
    close: vi.fn((callback?: (error?: Error) => void) => {
      callback?.();
      return server;
    }),
    closeIdleConnections: vi.fn(),
  };

  const options: ShutdownOptions = {
    server: server as unknown as Server,
    logger: logger as unknown as ShutdownOptions["logger"],
    processLike: processLike as unknown as NodeJS.Process,
  };

  return { options, logger, processLike, server };
};

describe("graceful shutdown lifecycle (issue #269)", () => {
  let harness: Harness;

  beforeEach(() => {
    harness = createHarness();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs exactly one shutdown sequence per signal; a second signal is ignored", () => {
    const shutdown = createShutdownHandler(harness.options);

    shutdown("SIGTERM");
    shutdown("SIGTERM");

    expect(harness.server.close).toHaveBeenCalledTimes(1);
    expect(harness.server.closeIdleConnections).toHaveBeenCalledTimes(1);
    expect(harness.processLike.exit).toHaveBeenCalledTimes(1);
    expect(harness.processLike.exit).toHaveBeenCalledWith(0);
    expect(harness.logger.info).toHaveBeenCalledWith(
      { signal: "SIGTERM" },
      "Graceful shutdown started",
    );
  });

  it("exits with code 1 when server.close reports an error", () => {
    harness.server.close.mockImplementation(
      (callback?: (error?: Error) => void) => {
        callback?.(new Error("close failed"));
        return harness.server;
      },
    );

    const shutdown = createShutdownHandler(harness.options);
    shutdown("SIGINT");

    expect(harness.processLike.exit).toHaveBeenCalledWith(1);
    expect(harness.logger.error).toHaveBeenCalledWith(
      { err: expect.any(Error) },
      "Error while shutting down server",
    );
  });

  it("forces exit(1) after the timeout when connections never drain", () => {
    vi.useFakeTimers();

    // A server whose connections never drain: close() never calls back.
    harness.server.close.mockImplementation(() => harness.server);

    const shutdown = createShutdownHandler(harness.options);
    shutdown("SIGTERM");

    expect(harness.processLike.exit).not.toHaveBeenCalled();

    vi.advanceTimersByTime(10_000);

    expect(harness.logger.error).toHaveBeenCalledWith(
      "Graceful shutdown timed out, forcing process exit",
    );
    expect(harness.processLike.exit).toHaveBeenCalledWith(1);
  });

  it("registers SIGINT/SIGTERM/unhandledRejection/uncaughtException on the process-like object", () => {
    registerProcessLifecycle(harness.options);

    harness.processLike.emit("SIGTERM");
    harness.processLike.emit("SIGINT");
    harness.processLike.emit("unhandledRejection", new Error("rejection"));
    harness.processLike.emit("uncaughtException", new Error("exception"));

    // Only the first lifecycle event shuts down; the rest are ignored.
    expect(harness.server.close).toHaveBeenCalledTimes(1);
    expect(harness.logger.fatal).toHaveBeenCalledTimes(2);
    expect(harness.logger.fatal).toHaveBeenCalledWith(
      { err: expect.any(Error) },
      "Unhandled Promise Rejection detected",
    );
    expect(harness.logger.fatal).toHaveBeenCalledWith(
      { err: expect.any(Error) },
      "Uncaught Exception detected",
    );
  });

  it("tolerates a server without closeIdleConnections", () => {
    const serverWithoutIdle = {
      close: vi.fn((callback?: (error?: Error) => void) => {
        callback?.();
        return serverWithoutIdle;
      }),
    };

    const shutdown = createShutdownHandler({
      ...harness.options,
      server: serverWithoutIdle as unknown as Server,
    });

    expect(() => shutdown("SIGTERM")).not.toThrow();
    expect(harness.processLike.exit).toHaveBeenCalledWith(0);
  });
});
