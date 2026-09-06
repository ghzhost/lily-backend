import { describe, expect, it } from "vitest";
import {
  createQuoteSchema,
  quoteSchema,
  stellarAssetCodeSchema,
} from "../src/modules/payments/payments.schema";

describe("quoteSchema amount validation", () => {
  it("accepts well-formed decimal amounts", () => {
    for (const amount of [
      "0",
      "0.50",
      "7",
      "100.00",
      "007.00",
      "1234567890.12",
    ]) {
      const result = quoteSchema.safeParse({
        assetCode: "USDC",
        amount,
        destination: "GABC",
      });
      expect(result.success, `expected ${amount} to be accepted`).toBe(true);
    }
  });

  it("rejects non-decimal amounts", () => {
    for (const amount of [
      "abc",
      "1.2.3",
      "1e5",
      "-1",
      "",
      "1.2.3.4",
      "  ",
      "0x10",
    ]) {
      const result = quoteSchema.safeParse({
        assetCode: "USDC",
        amount,
        destination: "GABC",
      });
      expect(
        result.success,
        `expected ${JSON.stringify(amount)} to be rejected`,
      ).toBe(false);
    }
  });
});

describe("stellarAssetCodeSchema", () => {
  it("accepts 1-12 alphanumeric codes", () => {
    for (const code of ["USDC", "XLM", "a", "BTC", "ABCDEFGHIJKL"]) {
      expect(stellarAssetCodeSchema.safeParse(code).success).toBe(true);
    }
  });

  it("rejects malformed currency codes", () => {
    for (const code of ["USDC!", "a b", "TOOLONGASSETCODEX", "", "US_DC"]) {
      expect(stellarAssetCodeSchema.safeParse(code).success).toBe(false);
    }
  });
});

describe("createQuoteSchema currency code validation", () => {
  it("accepts valid source and destination asset codes", () => {
    const result = createQuoteSchema.safeParse({
      sourceAsset: "USDC",
      destinationAsset: "XLM",
      sourceAmount: "100.00",
    });
    expect(result.success).toBe(true);
  });

  it("rejects malformed currency codes in either asset field", () => {
    for (const [sourceAsset, destinationAsset] of [
      ["USDC!", "XLM"],
      ["a b", "XLM"],
      ["USDC", "TOOLONGASSETCODEX"],
    ]) {
      const result = createQuoteSchema.safeParse({
        sourceAsset,
        destinationAsset,
        sourceAmount: "100.00",
      });
      expect(
        result.success,
        `expected ${sourceAsset}/${destinationAsset} to be rejected`,
      ).toBe(false);
    }
  });
});
