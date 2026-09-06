import { Router } from "express";

import { apiKeyAuth } from "../../common/http/api-key-auth.middleware";
import { idempotencyKeyMiddleware } from "../../common/http/idempotency.middleware";
import { validateBody } from "../../common/http/validate.middleware";
import {
  createAgent,
  deleteAgent,
  getAgentById,
  listAgents,
  updateAgentStatus,
} from "./agents.controller";
import { agentStatusSchema, createAgentSchema } from "./agents.schema";

export const agentsRouter = Router();

agentsRouter.use(apiKeyAuth);

agentsRouter.get("/", listAgents);
agentsRouter.get("/:id", getAgentById);
agentsRouter.post(
  "/",
  apiKeyAuth,
  idempotencyKeyMiddleware,
  validateBody(createAgentSchema),
  createAgent,
);
agentsRouter.patch(
  "/:id",
  apiKeyAuth,
  validateBody(agentStatusSchema),
  updateAgentStatus,
);
agentsRouter.delete("/:id", apiKeyAuth, deleteAgent);
