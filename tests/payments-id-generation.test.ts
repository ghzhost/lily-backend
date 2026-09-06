import { describe, expect, it } from "vitest";

import {
  generatePaymentId,
  generateQuoteId,
  paymentsService,
} from "../src/modules/payments/payments.service";

describe("Quote and payment ID generation (issue #290)", () => {
  const UUID_REGEX =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  it("generateQuoteId retains quote_ prefix and follows UUID v4 format", () => {
    const id = generateQuoteId();
    expect(id.startsWith("quote_")).toBe(true);

    const uuidPart = id.slice("quote_".length);
    expect(uuidPart).toMatch(UUID_REGEX);
  });

  it("generatePaymentId retains pay_ prefix and follows UUID v4 format", () => {
    const id = generatePaymentId();
    expect(id.startsWith("pay_")).toBe(true);

    const uuidPart = id.slice("pay_".length);
    expect(uuidPart).toMatch(UUID_REGEX);
  });

  it("consecutive rapid ID generations produce strictly unique IDs", () => {
    const quoteIds = new Set<string>();
    const paymentIds = new Set<string>();
    const count = 1000;

    for (let i = 0; i < count; i++) {
      quoteIds.add(generateQuoteId());
      paymentIds.add(generatePaymentId());
    }

    expect(quoteIds.size).toBe(count);
    expect(paymentIds.size).toBe(count);
  });

  it("paymentsService.createQuote produces UUID-backed quote ID", () => {
    const { quote } = paymentsService.createQuote({
      sourceAsset: "XLM",
      destinationAsset: "USDC",
      sourceAmount: "100.00",
    });

    expect(quote.id.startsWith("quote_")).toBe(true);
    expect(quote.id.slice("quote_".length)).toMatch(UUID_REGEX);
  });

  it("paymentsService.executePayment produces UUID-backed payment ID", () => {
    const { quote } = paymentsService.createQuote({
      sourceAsset: "XLM",
      destinationAsset: "USDC",
      sourceAmount: "50.00",
    });

    const { payment } = paymentsService.executePayment({
      quoteId: quote.id,
      confirmed: true,
    });

    expect(payment.id.startsWith("pay_")).toBe(true);
    expect(payment.id.slice("pay_".length)).toMatch(UUID_REGEX);
  });
});
