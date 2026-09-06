import { describe, expect, it } from "vitest";

import {
  createQuoteSchema,
  normalizeAmount,
  quoteSchema,
} from "../src/modules/payments/payments.schema";

describe("normalizeAmount", () => {
  it("strips leading zeros from integer part", () => {
    expect(normalizeAmount("007.00")).toBe("7.00");
  });

  it("preserves valid amounts without leading zeros", () => {
    expect(normalizeAmount("100.00")).toBe("100.00");
  });

  it("keeps single zero before decimal for sub-unit amounts", () => {
    expect(normalizeAmount("0.50")).toBe("0.50");
  });

  it("normalizes multiple leading zeros", () => {
    expect(normalizeAmount("0000123.45")).toBe("123.45");
  });

  it("handles integer-only amounts", () => {
    expect(normalizeAmount("007")).toBe("7");
  });

  it("trims whitespace", () => {
    expect(normalizeAmount("  007.00  ")).toBe("7.00");
  });
});

describe("quoteSchema", () => {
  it("normalizes amount on parse", () => {
    const result = quoteSchema.parse({
      assetCode: "USDC",
      amount: "007.00",
      destination: "GABC123",
    });
    expect(result.amount).toBe("7.00");
  });

  it("trims and validates destination", () => {
    const result = quoteSchema.parse({
      assetCode: "USDC",
      amount: "10.00",
      destination: "  GABC123  ",
    });
    expect(result.destination).toBe("GABC123");
  });

  it("rejects empty amount", () => {
    expect(() =>
      quoteSchema.parse({
        assetCode: "USDC",
        amount: "",
        destination: "GABC123",
      }),
    ).toThrow();
  });
});

describe("createQuoteSchema", () => {
  it("normalizes sourceAmount on parse", () => {
    const result = createQuoteSchema.parse({
      sourceAsset: "USDC",
      destinationAsset: "XLM",
      sourceAmount: "007.00",
    });
    expect(result.sourceAmount).toBe("7.00");
  });

  it("rejects missing assets", () => {
    expect(() =>
      createQuoteSchema.parse({
        sourceAsset: "USDC",
        sourceAmount: "100.00",
      }),
    ).toThrow();
  });
});

describe("paymentsService identifier generation (crypto.randomUUID)", () => {
  it("generates quote ids with quote_ prefix and UUID format", async () => {
    const { paymentsService } =
      await import("../src/modules/payments/payments.service");
    const { quote } = paymentsService.createQuote({
      sourceAsset: "USDC",
      destinationAsset: "XLM",
      sourceAmount: "100.00",
    });

    expect(quote.id).toMatch(
      /^quote_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it("generates payment ids with pay_ prefix and UUID format", async () => {
    const { paymentsService } =
      await import("../src/modules/payments/payments.service");
    const { quote } = paymentsService.createQuote({
      sourceAsset: "USDC",
      destinationAsset: "XLM",
      sourceAmount: "50.00",
    });

    const { payment } = paymentsService.executePayment({
      quoteId: quote.id,
      confirmed: true,
    });

    expect(payment.id).toMatch(
      /^pay_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
  });

  it("produces unique quote and payment ids across rapid same-millisecond sequential calls", async () => {
    const { paymentsService } =
      await import("../src/modules/payments/payments.service");
    const quoteIds = new Set<string>();
    const count = 100;

    for (let i = 0; i < count; i++) {
      const { quote } = paymentsService.createQuote({
        sourceAsset: "USDC",
        destinationAsset: "XLM",
        sourceAmount: "10.00",
      });
      quoteIds.add(quote.id);
    }

    expect(quoteIds.size).toBe(count);

    const paymentIds = new Set<string>();
    const sampleQuotes = Array.from(quoteIds).slice(0, 20);
    for (const qId of sampleQuotes) {
      const { payment } = paymentsService.executePayment({
        quoteId: qId,
        confirmed: true,
      });
      paymentIds.add(payment.id);
    }

    expect(paymentIds.size).toBe(20);
  });
});
