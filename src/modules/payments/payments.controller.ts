import type { Request, Response } from "express";
import type { z } from "zod";

import { asyncHandler } from "../../common/http/async-handler";
import type { ApiSuccessResponse } from "../../common/types/api-response";
import type { createQuoteSchema, executePaymentSchema } from "./payments.schema";
import { paymentsService } from "./payments.service";

type CreateQuoteBody = z.output<typeof createQuoteSchema>;
type ExecutePaymentBody = z.output<typeof executePaymentSchema>;

export const listPayments = (
  _request: Request,
  response: Response<
    ApiSuccessResponse<ReturnType<typeof paymentsService.listPayments>>
  >,
): void => {
  response.status(200).json({
    success: true,
    data: paymentsService.listPayments(),
  });
};

export const createQuote = asyncHandler(
  async (
    request: Request<
      Record<string, never>,
      ApiSuccessResponse<ReturnType<typeof paymentsService.createQuote>>,
      CreateQuoteBody
    >,
    response: Response<
      ApiSuccessResponse<ReturnType<typeof paymentsService.createQuote>>
    >,
  ) => {
    const result = paymentsService.createQuote({
      sourceAsset: request.body.sourceAsset,
      destinationAsset: request.body.destinationAsset,
      sourceAmount: request.body.sourceAmount,
    });

    response.status(201).json({ success: true, data: result });
  },
);

export const getQuote = asyncHandler(
  async (
    request: Request<
      { id: string },
      ApiSuccessResponse<ReturnType<typeof paymentsService.getQuoteById>>
    >,
    response: Response<
      ApiSuccessResponse<ReturnType<typeof paymentsService.getQuoteById>>
    >,
  ) => {
    const result = paymentsService.getQuoteById(request.params.id);

    response.status(200).json({ success: true, data: result });
  },
);

export const executePayment = asyncHandler(
  async (
    request: Request<
      Record<string, never>,
      ApiSuccessResponse<ReturnType<typeof paymentsService.executePayment>>,
      ExecutePaymentBody
    >,
    response: Response<
      ApiSuccessResponse<ReturnType<typeof paymentsService.executePayment>>
    >,
  ) => {
    const result = paymentsService.executePayment(request.body);

    response.status(200).json({ success: true, data: result });
  },
);

export const listPayments = asyncHandler(
  async (
    _request: Request,
    response: Response<
      ApiSuccessResponse<ReturnType<typeof paymentsService.listPayments>>
    >,
  ) => {
    const result = paymentsService.listPayments();

    response.status(200).json({ success: true, data: result });
  },
);
