import type { Request, Response } from "express";

import type { ApiSuccessResponse } from "@/common/types/api-response";
import { healthService } from "@/modules/health/health.service";

export const getHealthStatus = (
  _request: Request,
  response: Response<
    ApiSuccessResponse<ReturnType<typeof healthService.getStatus>>
  >,
): void => {
  response.status(200).json({
    success: true,
    data: healthService.getStatus(),
  });
};

export const getLivenessStatus = (
  _request: Request,
  response: Response<
    ApiSuccessResponse<ReturnType<typeof healthService.getLiveness>>
  >,
): void => {
  response.status(200).json({
    success: true,
    data: healthService.getLiveness(),
  });
};

export const getReadinessStatus = (
  _request: Request,
  response: Response<
    ApiSuccessResponse<ReturnType<typeof healthService.getReadiness>>
  >,
): void => {
  response.status(200).json({
    success: true,
    data: healthService.getReadiness(),
  });
};
