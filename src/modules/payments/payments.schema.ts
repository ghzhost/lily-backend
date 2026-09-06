import { z } from "zod";

/**
 * Normalizes a decimal amount string by stripping leading zeros
 * while preserving the canonical decimal form.
 * "007.00" -> "7.00", "0.50" -> "0.50", "100.00" -> "100.00"
 */
export const normalizeAmount = (val: string): string => {
  const trimmed = val.trim();
  if (!trimmed) return trimmed;

  const parts = trimmed.split(".");
  // Strip leading zeros from integer part, but keep at least one digit
  const intPart = (parts[0] ?? "").replace(/^0+/, "") || "0";
  const decPart = parts.length > 1 ? "." + parts.slice(1).join(".") : "";
  return intPart + decPart;
};

const amountString = z
  .string()
  .trim()
  .min(1)
  .regex(/^\d+(\.\d+)?$/, {
    message: "Amount must be a non-negative decimal number",
  })
  .transform((value) => normalizeAmount(value));

/**
 * Stellar asset codes are 1-12 alphanumeric characters. "XLM" represents the
 * native asset and is allowed as a special case of the same charset.
 */
export const stellarAssetCodeSchema = z
  .string()
  .trim()
  .min(1)
  .max(12)
  .regex(/^[A-Za-z0-9]+$/, {
    message: "Asset code must be 1-12 alphanumeric characters (e.g. USDC, XLM)",
  });

export const quoteSchema = z.object({
  assetCode: stellarAssetCodeSchema,
  amount: amountString,
  destination: z.string().trim().min(1),
});

export type QuoteInput = z.input<typeof quoteSchema>;
export type QuoteOutput = z.output<typeof quoteSchema>;

export const createQuoteSchema = z.object({
  sourceAsset: stellarAssetCodeSchema,
  destinationAsset: stellarAssetCodeSchema,
  sourceAmount: amountString,
});

export const executePaymentSchema = z.object({
  quoteId: z.string().trim().min(1),
  confirmed: z.boolean(),
});
