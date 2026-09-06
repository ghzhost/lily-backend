import type { Request, Response } from "express";

import { AppError } from "../../common/http/app-error";
import type { ApiSuccessResponse } from "../../common/types/api-response";
import type { AgentStatus, CreateAgentInput } from "./agents.types";
import type { ListAgentsQuery } from "./agents.schema";
import { agentsService } from "./agents.service";

export const listAgents = (
  request: Request,
  response: Response<
    ApiSuccessResponse<ReturnType<typeof agentsService.listAgents>>
  >,
): void => {
  const query = (request as Request & { validatedQuery?: ListAgentsQuery })
    .validatedQuery;
  const { limit, offset } = query ?? {};

  response.status(200).json({
    success: true,
    data: agentsService.listAgents(limit, offset),
  });
};

export const getAgentById = (
  request: Request<{ id: string }>,
  response: Response,
): void => {
  const agent = agentsService.getAgentById(request.params.id);

  if (!agent) {
    throw new AppError(
      404,
      `Agent not found: ${request.params.id}`,
      undefined,
      "NOT_FOUND",
    );
  }

  response.status(200).json({
    success: true,
    data: { agent },
  });
};

export const createAgent = (
  request: Request<Record<string, never>, unknown, CreateAgentInput>,
  response: Response,
): void => {
  const agent = agentsService.createAgent(request.body);

  response.status(201).json({
    success: true,
    data: { agent },
  });
};

export const updateAgentStatus = (
  request: Request<{ id: string }, unknown, { status: AgentStatus }>,
  response: Response<
    ApiSuccessResponse<ReturnType<typeof agentsService.updateAgentStatus>>
  >,
): void => {
  const data = agentsService.updateAgentStatus(
    request.params.id,
    request.body.status,
  );

  response.status(200).json({
    success: true,
    data,
  });
};

export const deleteAgent = (
  request: Request<{ id: string }>,
  response: Response,
): void => {
  if (!agentsService.deleteAgent(request.params.id)) {
    throw new AppError(
      404,
      `Agent not found: ${request.params.id}`,
      undefined,
      "NOT_FOUND",
    );
  }

  response.status(204).end();
};
