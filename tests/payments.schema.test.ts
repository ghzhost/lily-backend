import { describe, it, expect } from "vitest";
import {
  stellarAssetCodeSchema,
  quoteSchema,
} from "../src/modules/payments/payments.schema";

describe("stellarAssetCodeSchema", () => {
  it("accepts valid 3-12 uppercase letter codes", () => {
    expect(stellarAssetCodeSchema.safeParse("USDC").success).toBe(true);
  });

  it("accepts 3-character code (min length)", () => {
    expect(stellarAssetCodeSchema.safeParse("USD").success).toBe(true);
  });

  it("accepts 12-character code (max length)", () => {
    expect(stellarAssetCodeSchema.safeParse("ABCDEFGHIJKL").success).toBe(true);
  });

  it("accepts XLM (native asset special case)", () => {
    expect(stellarAssetCodeSchema.safeParse("XLM").success).toBe(true);
  });

  it("rejects lowercase codes", () => {
    const result = stellarAssetCodeSchema.safeParse("usd");
    expect(result.success).toBe(false);
  });

  it("rejects numeric-only codes", () => {
    const result = stellarAssetCodeSchema.safeParse("123");
    expect(result.success).toBe(false);
  });

  it("rejects mixed case codes", () => {
    const result = stellarAssetCodeSchema.safeParse("AbCd");
    expect(result.success).toBe(false);
  });

  it("rejects single character code (too short)", () => {
    const result = stellarAssetCodeSchema.safeParse("A");
    expect(result.success).toBe(false);
  });

  it("rejects two character code (too short)", () => {
    const result = stellarAssetCodeSchema.safeParse("AB");
    expect(result.success).toBe(false);
  });

  it("rejects empty string", () => {
    const result = stellarAssetCodeSchema.safeParse("");
    expect(result.success).toBe(false);
  });

  it("rejects code longer than 12 characters", () => {
    const result = stellarAssetCodeSchema.safeParse("ABCDEFGHIJKLM");
    expect(result.success).toBe(false);
  });

  it("rejects spaces in asset code", () => {
    const result = stellarAssetCodeSchema.safeParse("US DC");
    expect(result.success).toBe(false);
  });

  it("rejects hyphens in asset code", () => {
    const result = stellarAssetCodeSchema.safeParse("USD-CDC");
    expect(result.success).toBe(false);
  });

  it("rejects unicode/emoji in asset code", () => {
    const result = stellarAssetCodeSchema.safeParse("USD\u{1F600}");
    expect(result.success).toBe(false);
  });

  it("rejects special characters", () => {
    const result = stellarAssetCodeSchema.safeParse("US$DC");
    expect(result.success).toBe(false);
  });

  it("rejects underscores", () => {
    const result = stellarAssetCodeSchema.safeParse("US_DC");
    expect(result.success).toBe(false);
  });

  it("rejects alphanumeric codes with digits", () => {
    const result = stellarAssetCodeSchema.safeParse("USD1");
    expect(result.success).toBe(false);
  });
});

describe("quoteSchema", () => {
  it("accepts a valid quote request with XLM", () => {
    const result = quoteSchema.safeParse({
      assetCode: "XLM",
      amount: "100.50",
      destination: "GABC123",
    });
    expect(result.success).toBe(true);
  });

  it("accepts a valid quote request with USDC", () => {
    const result = quoteSchema.safeParse({
      assetCode: "USDC",
      amount: "50",
      destination: "GXYZ789",
    });
    expect(result.success).toBe(true);
  });

  it("rejects quote with invalid asset code containing space", () => {
    const result = quoteSchema.safeParse({
      assetCode: "US DC",
      amount: "50",
      destination: "GXYZ789",
    });
    expect(result.success).toBe(false);
  });

  it("rejects quote with missing amount", () => {
    const result = quoteSchema.safeParse({
      assetCode: "USDC",
      destination: "GXYZ789",
    });
    expect(result.success).toBe(false);
  });

  it("rejects quote with missing destination", () => {
    const result = quoteSchema.safeParse({
      assetCode: "USDC",
      amount: "50",
    });
    expect(result.success).toBe(false);
  });

  it("rejects quote with empty asset code", () => {
    const result = quoteSchema.safeParse({
      assetCode: "",
      amount: "50",
      destination: "GXYZ789",
    });
    expect(result.success).toBe(false);
  });

  it("rejects quote with emoji in asset code", () => {
    const result = quoteSchema.safeParse({
      assetCode: "USD\u{1F600}",
      amount: "50",
      destination: "GXYZ789",
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-decimal amounts like abc, -5, 1.2.3, 1e999 and amounts with >7 decimals", () => {
    const malformed = ["abc", "-5", "1.2.3", "1e999", "1.12345678", ""];
    for (const val of malformed) {
      const result = quoteSchema.safeParse({
        assetCode: "USDC",
        amount: val,
        destination: "GXYZ789",
      });
      expect(result.success).toBe(false);
    }
  });

  it("rejects invalid currency codes (lowercase, digits) and accepts 3 uppercase letters", () => {
    const invalidCurrencies = ["usd", "123", "US", "USDC", "US!"];
    for (const curr of invalidCurrencies) {
      const result = quoteSchema.safeParse({
        currency: curr,
        amount: "50.00",
        destination: "GXYZ789",
      });
      expect(result.success).toBe(false);
    }

    const validResult = quoteSchema.safeParse({
      currency: "USD",
      amount: "50.00",
      destination: "GXYZ789",
    });
    expect(validResult.success).toBe(true);
  });

  it("parses valid decimal values like 7.50 and 100.00 with normalized output unchanged", () => {
    const res1 = quoteSchema.safeParse({
      currency: "USD",
      amount: "7.50",
      destination: "GXYZ789",
    });
    expect(res1.success).toBe(true);
    if (res1.success) {
      expect(res1.data.amount).toBe("7.50");
    }

    const res2 = quoteSchema.safeParse({
      assetCode: "USDC",
      amount: "100.00",
      destination: "GXYZ789",
    });
    expect(res2.success).toBe(true);
    if (res2.success) {
      expect(res2.data.amount).toBe("100.00");
    }
  });
});

describe("amountString validation (via quoteSchema.amount)", () => {
  const parse = (v: string) =>
    quoteSchema.safeParse({ assetCode: "USDC", amount: v, destination: "G" + "A".repeat(55) });

  // Acceptance criteria: valid values
  it("accepts '7.50' and preserves normalized output", () => {
    const result = parse("7.50");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amount).toBe("7.50");
    }
  });

  it("accepts '100.00' and preserves normalized output", () => {
    const result = parse("100.00");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amount).toBe("100.00");
    }
  });

  it("accepts a plain integer", () => {
    expect(parse("100").success).toBe(true);
  });

  it("accepts a decimal with up to 7 places", () => {
    expect(parse("0.1234567").success).toBe(true);
  });

  it("accepts zero", () => {
    expect(parse("0").success).toBe(true);
  });

  // Acceptance criteria: rejected values
  it("rejects alphabetic input 'abc'", () => {
    expect(parse("abc").success).toBe(false);
  });

  it("rejects negative amounts '-5'", () => {
    expect(parse("-5").success).toBe(false);
  });

  it("rejects multi-dot amounts '1.2.3'", () => {
    expect(parse("1.2.3").success).toBe(false);
  });

  it("rejects scientific notation '1e999'", () => {
    expect(parse("1e999").success).toBe(false);
  });

  it("rejects more than 7 decimal places", () => {
    expect(parse("1.12345678").success).toBe(false);
  });

  it("rejects empty string after trim", () => {
    expect(parse("   ").success).toBe(false);
  });

  it("normalizes leading zeros", () => {
    const result = parse("007.00");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amount).toBe("7.00");
    }
  });
});

describe("assetCode validation (via quoteSchema.assetCode)", () => {
  const parse = (v: string) =>
    quoteSchema.safeParse({ assetCode: v, amount: "100", destination: "G" + "A".repeat(55) });

  // Acceptance criteria: accepts uppercase
  it("accepts 'USD' (uppercase)", () => {
    expect(parse("USD").success).toBe(true);
  });

  // Acceptance criteria: rejects lowercase
  it("rejects 'usd' (lowercase)", () => {
    expect(parse("usd").success).toBe(false);
  });

  // Acceptance criteria: rejects numeric-only
  it("rejects '123' (numeric-only)", () => {
    expect(parse("123").success).toBe(false);
  });
});

describe("amountString (via quoteSchema.amount)", () => {
  const parse = (v: string) =>
    quoteSchema.safeParse({ assetCode: "USDC", amount: v, destination: "G" + "A".repeat(55) });

  it("accepts a plain integer", () => {
    expect(parse("100").success).toBe(true);
  });

  it("accepts a decimal with up to 7 places", () => {
    expect(parse("0.1234567").success).toBe(true);
  });

  it("accepts zero", () => {
    expect(parse("0").success).toBe(true);
  });

  it("rejects alphabetic input", () => {
    expect(parse("abc").success).toBe(false);
  });

  it("rejects negative amounts", () => {
    expect(parse("-5").success).toBe(false);
  });

  it("rejects multi-dot amounts", () => {
    expect(parse("1.2.3").success).toBe(false);
  });

  it("rejects scientific notation", () => {
    expect(parse("1e999").success).toBe(false);
  });

  it("rejects empty string after trim", () => {
    expect(parse("   ").success).toBe(false);
  });

  it("rejects more than 7 decimal places", () => {
    expect(parse("1.12345678").success).toBe(false);
  });

  it("normalizes leading zeros", () => {
    const result = parse("007.00");
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.amount).toBe("7.00");
    }
  });
});
