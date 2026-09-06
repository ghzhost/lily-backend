import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  applyStubFee,
  multiplyExactDecimal,
  paymentsService,
} from "../src/modules/payments/payments.service";

describe("applyStubFee", () => {
  it.each([
    ["100", "1"],
    ["0.01", "0.0001"],
    ["1.00", "0.01"],
    ["0", "0"],
    ["0.0000000", "0"],
    ["0.0000001", "0.000000001"],
    ["1.2345678", "0.012345678"],
    [LARGE_SOURCE, "123456789012345678901234567890123456789012345678.9"],
  ])("calculates a one-percent fee for %s", (amount, expectedFee) => {
    expect(applyStubFee(amount)).toBe(expectedFee);
  });
});

describe("multiplyExactDecimal", () => {
  it("multiplies exact decimals without floating point errors", () => {
    expect(multiplyExactDecimal("100", "1.0002")).toBe("100.02");
    expect(multiplyExactDecimal("0.01", "1.0002")).toBe("0.010002");
    expect(multiplyExactDecimal("0", "1.0002")).toBe("0");
    expect(multiplyExactDecimal("1000000000000000000000", "1.0002")).toBe(
      "1000200000000000000000",
    );
  });
});

describe("createQuote fee and destination math consistency (issue #286)", () => {
  it("returns a fee for 100 consistent with applyStubFee", () => {
    const { quote } = paymentsService.createQuote({
      sourceAsset: "USDC",
      destinationAsset: "XLM",
      sourceAmount: "100",
    });

    expect(quote.fee).toBe("1");
    expect(quote.fee).toBe(applyStubFee("100"));
    expect(quote.destinationAmount).toBe("100.02");
  });

  it("handles large amounts without floating-point artifacts (no 1e+21 format)", () => {
    const largeAmount = "1000000000000000000000";
    const { quote } = paymentsService.createQuote({
      sourceAsset: "USDC",
      destinationAsset: "XLM",
      sourceAmount: largeAmount,
    });

    expect(quote.fee).toBe("10000000000000000000");
    expect(quote.fee).not.toMatch(/[eE]/);
    expect(quote.destinationAmount).toBe("1000200000000000000000");
    expect(quote.destinationAmount).not.toMatch(/[eE]/);
  });

  it("handles high-precision sub-unit amounts without floating-point artifacts", () => {
    const precisionAmount = "0.0000001";
    const { quote } = paymentsService.createQuote({
      sourceAsset: "USDC",
      destinationAsset: "XLM",
      sourceAmount: precisionAmount,
    });

    expect(quote.fee).toBe("0.000000001");
    expect(quote.fee).not.toMatch(/[eE]/);
    expect(quote.destinationAmount).toBe("0.00000010002");
    expect(quote.destinationAmount).not.toMatch(/[eE]/);
  });
});
