import { Router } from "express";

import { apiKeyAuth } from "../../common/http/api-key-auth.middleware";
import { validateBody } from "../../common/http/validate.middleware";
import {
  createQuote,
  executePayment,
  getQuote,
  listPayments,
} from "./payments.controller";
import { createQuoteSchema, executePaymentSchema } from "./payments.schema";

export const paymentsRouter = Router();

paymentsRouter.post("/", apiKeyAuth, validateBody(createQuoteSchema), createQuote);
paymentsRouter.get("/quotes/:id", getQuote);
paymentsRouter.post(
  "/execute",
  apiKeyAuth,
  validateBody(executePaymentSchema),
  executePayment,
);
