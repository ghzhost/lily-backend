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

const decimalAmountRegex = /^\d+(\.\d{1,7})?$/;

const amountString = z
  .string()
  .trim()
  .min(1)
  .regex(/^\d+(\.\d+)?$/, {
    message: "Amount must be a non-negative decimal number",
  })
  .transform((value) => normalizeAmount(value));

/**
 * Stellar asset codes are 3-12 uppercase letters. "XLM" represents the
 * native asset. Lowercase and numeric-only codes are rejected.
 */
export const stellarAssetCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Z]{3,12}$/, {
    message: "Asset code must be 3-12 uppercase letters (e.g. USDC, XLM)",
  });

export const currencySchema = z
  .string()
  .trim()
  .regex(/^[A-Z]{3}$/, {
    message: "Currency must be three uppercase letters (e.g. USD)",
  });

export const quoteSchema = z
  .object({
    assetCode: stellarAssetCodeSchema.optional(),
    currency: currencySchema.optional(),
    amount: amountString,
    destination: z.string().trim().min(1),
  })
  .refine(
    (data) => data.assetCode !== undefined || data.currency !== undefined,
    {
      message: "Either assetCode or currency must be provided",
    },
  );

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
