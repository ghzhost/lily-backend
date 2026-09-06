import type { Request, Response } from "express";

import { asyncHandler } from "../../common/http/async-handler";
import type { ApiSuccessResponse } from "../../common/types/api-response";
import { paymentsService } from "./payments.service";
import type { ExecutePaymentInput } from "./payments.types";

interface CreateQuoteBody {
  sourceAsset: string;
  destinationAsset: string;
  sourceAmount: string;
}

export const createQuote = asyncHandler(
  async (
    request: Request,
    response: Response<
      ApiSuccessResponse<ReturnType<typeof paymentsService.createQuote>>
    >,
  ) => {
    const body = request.body as CreateQuoteBody;
    const result = paymentsService.createQuote({
      sourceAsset: body.sourceAsset,
      destinationAsset: body.destinationAsset,
      sourceAmount: body.sourceAmount,
    });

    response.status(201).json({ success: true, data: result });
  },
);

export const getQuote = asyncHandler(
  async (
    request: Request,
    response: Response<
      ApiSuccessResponse<ReturnType<typeof paymentsService.getQuoteById>>
    >,
  ) => {
    const result = paymentsService.getQuoteById(request.params.id as string);

    response.status(200).json({ success: true, data: result });
  },
);

export const executePayment = asyncHandler(
  async (
    request: Request,
    response: Response<
      ApiSuccessResponse<ReturnType<typeof paymentsService.executePayment>>
    >,
  ) => {
    const body = request.body as ExecutePaymentInput;
    const result = paymentsService.executePayment(body);

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
