export type QuoteStatus = "active" | "expired" | "executed";

export interface Quote {
  id: string;
  sourceAsset: string;
  destinationAsset: string;
  sourceAmount: string;
  destinationAmount: string;
  fee: string;
  rate: string;
  expiresAt: string;
  createdAt: string;
  status: QuoteStatus;
}

export interface PaymentRecord {
  id: string;
  quoteId: string;
  sourceAsset: string;
  destinationAsset: string;
  sourceAmount: string;
  destinationAmount: string;
  fee: string;
  rate: string;
  status: "settled";
  createdAt: string;
}

export interface CreateQuoteInput {
  sourceAsset: string;
  destinationAsset: string;
  sourceAmount: string;
}

export interface CreateQuoteResponse {
  quote: Quote;
}

export interface GetQuoteResponse {
  quote: Quote;
}

export interface ExecutePaymentInput {
  quoteId: string;
  confirmed: boolean;
}

export interface ExecutePaymentResponse {
  payment: PaymentRecord;
}

export interface ListPaymentsResponse {
  total: number;
  payments: PaymentRecord[];
}
