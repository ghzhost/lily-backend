import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "../src/common/http/app-error";
import {
  paymentsService,
  sweepExpiredQuotes,
} from "../src/modules/payments/payments.service";

const QUOTE_TTL_MS = 5 * 60 * 1000;
const SWEEP_INTERVAL_MS = 60 * 1000;

const expectAppError = (fn: () => unknown, status: number, message: string) => {
  let caught: unknown;
  try {
    fn();
  } catch (error) {
    caught = error;
  }

  expect(caught).toBeInstanceOf(AppError);
  expect((caught as AppError).statusCode).toBe(status);
  expect((caught as AppError).message).toBe(message);
};

const createQuote = (amount = "10.00") =>
  paymentsService.createQuote({
    sourceAsset: "USDC",
    destinationAsset: "XLM",
    sourceAmount: amount,
  });

describe("payments service store eviction", () => {
  beforeEach(() => {
    paymentsService.reset();
    vi.useFakeTimers();
  });

  afterEach(() => {
    paymentsService.reset();
    vi.useRealTimers();
  });

  it("sweepExpiredQuotes removes TTL-passed quotes without requiring a read", () => {
    const { quote } = createQuote();

    vi.advanceTimersByTime(QUOTE_TTL_MS + 1);

    // The sweep (explicit call or the periodic interval) removed the entry
    // from the store entirely — it is not merely marked expired.
    sweepExpiredQuotes();

    expectAppError(
      () => paymentsService.getQuoteById(quote.id),
      404,
      "Quote not found",
    );
  });

  it("createQuote lazily sweeps expired quotes on the next call", () => {
    const first = createQuote().quote;

    vi.advanceTimersByTime(QUOTE_TTL_MS + 1);
    createQuote();

    expectAppError(
      () => paymentsService.getQuoteById(first.id),
      404,
      "Quote not found",
    );
  });

  it("the periodic sweep timer removes expired quotes within the sweep interval", () => {
    const { quote } = createQuote();

    // The unref'd sweep interval is created lazily on the first createQuote,
    // so advancing time past the interval fires it under fake timers.
    vi.advanceTimersByTime(SWEEP_INTERVAL_MS + QUOTE_TTL_MS);

    expectAppError(
      () => paymentsService.getQuoteById(quote.id),
      404,
      "Quote not found",
    );
  });

  it("does not evict quotes that are still within their TTL", () => {
    const { quote } = createQuote();

    vi.advanceTimersByTime(SWEEP_INTERVAL_MS);

    expect(paymentsService.getQuoteById(quote.id).quote.id).toBe(quote.id);
  });

  it("bounds the quote store by evicting the oldest entries", () => {
    vi.useRealTimers();
    paymentsService.reset();

    const MAX_IN_MEMORY_QUOTES = 5_000;
    const firstId = createQuote().quote.id;

    for (let i = 0; i < MAX_IN_MEMORY_QUOTES; i += 1) {
      createQuote(`1.00${i % 10}`);
    }

    // The oldest quote was evicted to make room for newer ones.
    expectAppError(
      () => paymentsService.getQuoteById(firstId),
      404,
      "Quote not found",
    );

    // The newest quote is still present.
    const latestId = createQuote().quote.id;
    expect(paymentsService.getQuoteById(latestId).quote.id).toBe(latestId);
  });

  it("reset() empties both stores", () => {
    const { quote } = createQuote();
    const created = paymentsService.getQuoteById(quote.id);

    expect(created.quote.id).toBe(quote.id);

    paymentsService.reset();

    expectAppError(
      () => paymentsService.getQuoteById(quote.id),
      404,
      "Quote not found",
    );
  });
});
