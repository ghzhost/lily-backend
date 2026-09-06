import crypto from "node:crypto";
import { AppError } from "../../common/http/app-error";
import type { Capability } from "./agents.schema";
import type { Agent, AgentStatus, CreateAgentInput } from "./agents.types";

const MAX_IN_MEMORY_AGENTS = 5_000;

const initialAgents: Agent[] = [
  {
    id: "agentlily_demo_001",
    name: "Treasury Settlement Agent",
    description:
      "AgentLily instance responsible for orchestrating treasury rebalancing operations.",
    walletAddress: "GBVDO6P6E3S6XG2Z5V5L7N3Z6Y2K4J5H7F8D9S0A1B2C3D4E5F6G7H8I",
    status: "active",
    capabilities: [
      "settlement",
      "rebalance",
      "liquidity-monitoring",
    ] satisfies Capability[],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

let agents: Agent[] = [...initialAgents];
let agentSequence = initialAgents.length + 1;

export const agentsService = {
  listAgents: (
    limit?: number,
    offset?: number,
  ): { total: number; agents: Agent[] } => {
    const start = Math.max(0, offset ?? 0);
    const end = limit !== undefined ? start + Math.max(0, limit) : undefined;
    return {
      total: agents.length,
      agents: agents.slice(start, end),
    };
  },

  getAgentById: (id: string): Agent | undefined => {
    return agents.find((agent) => agent.id === id);
  },

  createAgent: (input: CreateAgentInput): Agent => {
    const now = new Date().toISOString();
    const slug = input.name.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    const effectiveSeed =
      slug.length > 0
        ? slug
        : crypto
            .createHash("sha256")
            .update(input.name)
            .digest("hex")
            .toUpperCase();
    const walletAddress = `G${effectiveSeed.padEnd(55, "0").slice(0, 55)}`;

    if (agents.some((candidate) => candidate.walletAddress === walletAddress)) {
      throw new AppError(409, "Agent with this wallet address already exists");
    }

    if (agents.some((agent) => agent.walletAddress === walletAddress)) {
      throw new AppError(409, "Agent wallet address already exists");
    }

    const agent: Agent = {
      id: `agentlily_${agentSequence++}`,
      name: input.name,
      description: input.description,
      walletAddress,
      status: "active",
      capabilities: input.capabilities,
      createdAt: now,
      updatedAt: now,
    };

    if (agents.length >= MAX_IN_MEMORY_AGENTS) {
      agents.shift();
    }

    agents.push(agent);
    return agent;
  },

  updateAgentStatus: (id: string, status: AgentStatus): { agent: Agent } => {
    const agent = agents.find((candidate) => candidate.id === id);

    if (!agent) {
      throw new AppError(404, "Agent not found", undefined, "NOT_FOUND");
    }

    agent.status = status;
    agent.updatedAt = new Date().toISOString();

    return { agent };
  },

  deleteAgent: (id: string): boolean => {
    const index = agents.findIndex((agent) => agent.id === id);

    if (index === -1) {
      return false;
    }

    agents.splice(index, 1);
    return true;
  },

  reset: (): void => {
    agents = [...initialAgents];
    agentSequence = initialAgents.length + 1;
  },
};
