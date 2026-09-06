import { describe, expect, it } from "vitest";

import { paymentsService } from "../src/modules/payments/payments.service";

const baseQuoteInput = {
  sourceAsset: "USDC",
  destinationAsset: "XLM",
  sourceAmount: "10.00",
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe("paymentsService id generation (#290)", () => {
  it("emits quote ids with the quote_ prefix", () => {
    const result = paymentsService.createQuote(baseQuoteInput);
    expect(result.quote.id.startsWith("quote_")).toBe(true);
  });

  it("emits payment ids with the pay_ prefix", () => {
    const result = paymentsService.createQuote(baseQuoteInput);
    const execution = paymentsService.executePayment({
      quoteId: result.quote.id,
      confirmed: true,
    });
    expect(execution.payment.id.startsWith("pay_")).toBe(true);
  });

  it("quote id suffix is a valid UUID", () => {
    const result = paymentsService.createQuote(baseQuoteInput);
    const uuid = result.quote.id.slice("quote_".length);
    expect(uuid).toMatch(UUID_PATTERN);
  });

  it("payment id suffix is a valid UUID", () => {
    const result = paymentsService.createQuote(baseQuoteInput);
    const execution = paymentsService.executePayment({
      quoteId: result.quote.id,
      confirmed: true,
    });
    const uuid = execution.payment.id.slice("pay_".length);
    expect(uuid).toMatch(UUID_PATTERN);
  });

  it("consecutive createQuote calls produce unique ids even within the same millisecond", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i += 1) {
      const result = paymentsService.createQuote(baseQuoteInput);
      ids.add(result.quote.id);
    }
    expect(ids.size).toBe(1000);
  });
});
