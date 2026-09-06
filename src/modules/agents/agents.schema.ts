import { z } from "zod";

export const capabilityEnum = z.enum([
  "wallet-provisioning",
  "usdc-payments",
  "settlement",
  "payments",
  "marketplace-purchases",
  "rebalance",
  "liquidity-monitoring",
  "wallet",
  "monitoring",
  "test",
  "testing",
]);

export type Capability = z.infer<typeof capabilityEnum>;

const capabilityValue = z.string().trim().toLowerCase().pipe(capabilityEnum);

export const createAgentSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    description: z.string().trim().min(10).max(280),
    capabilities: z
      .array(capabilityValue)
      .min(1)
      .max(10)
      .transform((caps) => [...new Set(caps)]),
  })
  .strict();

export const patchAgentSchema = z
  .object({
    status: z.enum(["active", "paused"]).optional(),
  })
  .refine((data) => data.status !== undefined, {
    message: "At least one field must be provided",
  });

export type CreateAgentSchema = z.output<typeof createAgentSchema>;

export const agentStatusSchema = z.object({
  status: z.enum(["active", "paused"]),
});

export type AgentStatusSchema = z.output<typeof agentStatusSchema>;

export const listAgentsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListAgentsQuery = z.output<typeof listAgentsQuerySchema>;

