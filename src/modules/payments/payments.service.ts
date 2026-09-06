import { randomUUID } from "node:crypto";
import { AppError } from "../../common/http/app-error";
import type {
  CreateQuoteInput,
  CreateQuoteResponse,
  ExecutePaymentInput,
  ExecutePaymentResponse,
  GetQuoteResponse,
  ListPaymentsResponse,
  PaymentRecord,
  Quote,
} from "./payments.types";

const QUOTE_TTL_MS = 5 * 60 * 1000;
const SWEEP_INTERVAL_MS = 60 * 1000;
const MAX_IN_MEMORY_QUOTES = 5_000;

const quotesStore = new Map<string, Quote>();
const paymentsStore: PaymentRecord[] = [];

let sweepTimer: ReturnType<typeof setInterval> | undefined;

/**
 * Removes quotes whose TTL has passed from the store even if they were
 * never read. Returns the number of entries removed.
 */
export const sweepExpiredQuotes = (now: number = Date.now()): number => {
  let removed = 0;
  for (const [id, quote] of quotesStore) {
    if (new Date(quote.expiresAt).getTime() <= now) {
      quotesStore.delete(id);
      removed += 1;
    }
  }
  return removed;
};

const ensureSweepTimer = (): void => {
  if (sweepTimer) {
    return;
  }
  sweepTimer = setInterval(() => {
    sweepExpiredQuotes();
  }, SWEEP_INTERVAL_MS);
  sweepTimer.unref?.();
};

/**
 * Cheap lazy eviction used on the write path: quotes share one TTL, so
 * expired entries always sit at the front of the insertion-ordered Map.
 * Scanning from the front keeps createQuote O(1) amortized while the
 * periodic timer handles the full sweep.
 */
const evictExpiredFromFront = (): void => {
  for (;;) {
    const oldest = quotesStore.entries().next();
    if (oldest.done) {
      break;
    }
    const [id, quote] = oldest.value;
    if (new Date(quote.expiresAt).getTime() > Date.now()) {
      break;
    }
    quotesStore.delete(id);
  }
};

const generateQuoteId = (): string => {
  return `quote_${crypto.randomUUID()}`;
};

const generatePaymentId = (): string => {
  return `pay_${crypto.randomUUID()}`;
};

interface ParsedDecimal {
  value: bigint;
  scale: number;
}

const parseDecimal = (input: string): ParsedDecimal => {
  const trimmed = input.trim();
  const negative = trimmed.startsWith("-");
  const unsigned = negative ? trimmed.slice(1) : trimmed;
  const [integerPart = "0", fractionalPart = ""] = unsigned.split(".");
  const digits = `${integerPart || "0"}${fractionalPart}`.replace(/^0+(?=\d)/, "") || "0";

  return {
    value: (negative ? -1n : 1n) * BigInt(digits),
    scale: fractionalPart.length,
  };
};

const formatDecimal = (value: bigint, scale: number): string => {
  if (value === 0n) return "0";

  const negative = value < 0n;
  let digits = (negative ? -value : value).toString();

  if (scale === 0) {
    return `${negative ? "-" : ""}${digits}`;
  }

  digits = digits.padStart(scale + 1, "0");
  const integerPart = digits.slice(0, -scale);
  const fractionalPart = digits.slice(-scale).replace(/0+$/, "");
  const sign = negative ? "-" : "";

  return fractionalPart ? `${sign}${integerPart}.${fractionalPart}` : `${sign}${integerPart}`;
};

const multiplyDecimal = (left: string, right: string): string => {
  const leftValue = parseDecimal(left);
  const rightValue = parseDecimal(right);

  return formatDecimal(leftValue.value * rightValue.value, leftValue.scale + rightValue.scale);
};

/**
 * Applies a one-percent fee to an amount string using exact decimal
 * arithmetic so large and high-precision amounts are not distorted by
 * floating point rounding.
 */
export const applyStubFee = (amount: string): string => {
  return multiplyDecimal(amount, "0.01");
};

export const multiplyExactDecimal = (
  amount: string,
  multiplier: string,
): string => {
  const trimmed = amount.trim();
  if (!trimmed || trimmed === "0" || trimmed === "-0") {
    return "0";
  }

  const isNegative = trimmed.startsWith("-");
  const unsigned = isNegative ? trimmed.slice(1) : trimmed;
  const [intA, fracA = ""] = unsigned.split(".");
  const digitsA = intA + fracA;
  const scaleA = fracA.length;

  const [intB, fracB = ""] = multiplier.trim().split(".");
  const digitsB = intB + fracB;
  const scaleB = fracB.length;

  let scale = scaleA + scaleB;
  let big =
    BigInt(digitsA.replace(/^0+(?=\d)/, "") || "0") *
    BigInt(digitsB.replace(/^0+(?=\d)/, "") || "0");

  while (scale > 0 && big % 10n === 0n) {
    big /= 10n;
    scale -= 1;
  }

  if (big === 0n) {
    return "0";
  }

  const sign = isNegative ? "-" : "";

  if (scale === 0) {
    return `${sign}${big.toString()}`;
  }

  const padded = big.toString().padStart(scale + 1, "0");
  const intResult = padded.slice(0, padded.length - scale);
  const fracResult = padded.slice(-scale);

  return `${sign}${intResult}.${fracResult}`;
};

const computeDestinationAmount = (sourceAmount: string): string => {
  return multiplyExactDecimal(sourceAmount, "1.0002");
};

const computeFee = (sourceAmount: string): string => {
  return applyStubFee(sourceAmount);
};

const refreshExpiry = (quote: Quote): void => {
  if (Date.now() >= new Date(quote.expiresAt).getTime()) {
    quote.status = "expired";
  }
};

export const paymentsService = {
  createQuote(input: CreateQuoteInput): CreateQuoteResponse {
    evictExpiredFromFront();
    ensureSweepTimer();

    const now = new Date();
    const quote: Quote = {
      id: generateQuoteId(),
      sourceAsset: input.sourceAsset,
      destinationAsset: input.destinationAsset,
      sourceAmount: input.sourceAmount,
      destinationAmount: computeDestinationAmount(input.sourceAmount),
      fee: computeFee(input.sourceAmount),
      rate: QUOTE_RATE,
      expiresAt: new Date(now.getTime() + QUOTE_TTL_MS).toISOString(),
      createdAt: now.toISOString(),
      status: "active",
    };

    quotesStore.set(quote.id, quote);

    // Bound the in-memory quote store: evict the oldest entries (Map
    // preserves insertion order) once the configured maximum is exceeded.
    while (quotesStore.size > MAX_IN_MEMORY_QUOTES) {
      const oldestId = quotesStore.keys().next().value;
      if (oldestId === undefined) {
        break;
      }
      quotesStore.delete(oldestId);
    }

    return { quote };
  },

  getQuoteById(id: string): GetQuoteResponse {
    const quote = quotesStore.get(id);

    if (!quote) {
      throw new AppError(404, "Quote not found");
    }

    refreshExpiry(quote);

    if (quote.status === "expired") {
      throw new AppError(410, "Quote has expired");
    }

    return { quote };
  },

  executePayment(input: ExecutePaymentInput): ExecutePaymentResponse {
    const quote = quotesStore.get(input.quoteId);

    if (!quote) {
      throw new AppError(404, "Quote not found");
    }

    refreshExpiry(quote);

    if (quote.status === "expired") {
      throw new AppError(410, "Quote has expired");
    }

    if (quote.status === "executed") {
      throw new AppError(409, "Quote has already been executed");
    }

    if (!input.confirmed) {
      throw new AppError(400, "Payment must be confirmed");
    }

    const payment: PaymentRecord = {
      id: generatePaymentId(),
      quoteId: quote.id,
      sourceAsset: quote.sourceAsset,
      destinationAsset: quote.destinationAsset,
      sourceAmount: quote.sourceAmount,
      destinationAmount: quote.destinationAmount,
      fee: quote.fee,
      rate: quote.rate,
      status: "settled",
      createdAt: new Date().toISOString(),
    };

    paymentsStore.push(payment);
    quote.status = "executed";

    return { payment };
  },

  listPayments(): { total: number; payments: PaymentRecord[] } {
    return {
      total: paymentsStore.length,
      payments: [...paymentsStore],
    };
  },

  reset(): void {
    quotesStore.clear();
    paymentsStore.splice(0, paymentsStore.length);

    if (sweepTimer) {
      clearInterval(sweepTimer);
      sweepTimer = undefined;
    }
  },
};
