import type { NextFunction, Request, Response } from "express";

interface IdempotencyEntry {
  response: unknown;
  statusCode: number;
  createdAt: number;
}

export const DEFAULT_IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
export const DEFAULT_IDEMPOTENCY_MAX_ENTRIES = 1000;
export const DEFAULT_SWEEP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

const store = new Map<string, IdempotencyEntry>();
let ttlMs = DEFAULT_IDEMPOTENCY_TTL_MS;
let maxEntries = DEFAULT_IDEMPOTENCY_MAX_ENTRIES;

/**
 * Sweeps entries that have exceeded ttlMs.
 * Returns the count of evicted expired entries.
 */
export const sweepExpiredEntries = (): number => {
  const now = Date.now();
  let evicted = 0;
  for (const [key, entry] of store.entries()) {
    if (now - entry.createdAt >= ttlMs) {
      store.delete(key);
      evicted++;
    }
  }
  return evicted;
};

// Periodic background sweep timer with .unref() so it never blocks process exit
const sweepTimer = setInterval(() => {
  sweepExpiredEntries();
}, DEFAULT_SWEEP_INTERVAL_MS);
sweepTimer.unref();

export const idempotencyKeyMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (req.method !== "POST") {
    next();
    return;
  }

  const key = req.headers["idempotency-key"];
  if (!key || typeof key !== "string" || key.length === 0) {
    next();
    return;
  }

  const now = Date.now();
  const existing = store.get(key);

  if (existing) {
    if (now - existing.createdAt < ttlMs) {
      res.status(existing.statusCode).json(existing.response);
      return;
    }
    // Expired entry found on lookup; clean up proactively
    store.delete(key);
  }

  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    // Issue #284: Only cache successful reproducible 2xx responses
    if (res.statusCode >= 200 && res.statusCode < 300) {
      // Issue #288: Bound store capacity using oldest-first (FIFO/LRU) eviction
      if (store.size >= maxEntries && !store.has(key)) {
        const oldestKey = store.keys().next().value;
        if (oldestKey !== undefined) {
          store.delete(oldestKey);
        }
      }
      store.set(key, {
        response: body,
        statusCode: res.statusCode,
        createdAt: Date.now(),
      });
    }
    return originalJson(body);
  }) as typeof res.json;

  next();
};

// Test seams
export const _getIdempotencyStoreSize = (): number => store.size;

export const _setIdempotencyConfig = (config: {
  maxEntries?: number;
  ttlMs?: number;
}): void => {
  if (config.maxEntries !== undefined) {
    maxEntries = config.maxEntries;
  }
  if (config.ttlMs !== undefined) {
    ttlMs = config.ttlMs;
  }
};

export const _resetIdempotencyConfig = (): void => {
  maxEntries = DEFAULT_IDEMPOTENCY_MAX_ENTRIES;
  ttlMs = DEFAULT_IDEMPOTENCY_TTL_MS;
};

export const _sweepIdempotencyStore = sweepExpiredEntries;

export const _resetIdempotencyStore = (): void => {
  store.clear();
  _resetIdempotencyConfig();
};

export const clearIdempotencyStore = _resetIdempotencyStore;

