import type { Express } from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "@/app";
import { agentsService } from "@/modules/agents/agents.service";
import { capabilityEnum } from "@/modules/agents/agents.schema";

const app: Express = createApp();

describe("agent endpoints", () => {
  it("exposes reset that restores the seeded agents for test isolation", async () => {
    agentsService.reset();
    const response = await request(app).get("/api/v1/agents");

    expect(response.status).toBe(200);
    expect(response.body.data.total).toBe(1);
  });

  it("returns only allowlisted capabilities for seeded and created agents", async () => {
    agentsService.reset();
    const allowlist = capabilityEnum.options;

    // Create an agent with valid capabilities
    await request(app)
      .post("/api/v1/agents")
      .send({
        name: "Payments Agent",
        description:
          "AgentLily responsible for processing USDC payments and settlements.",
        capabilities: ["usdc-payments", "settlement"],
      });

    const response = await request(app).get("/api/v1/agents");
    expect(response.status).toBe(200);

    for (const agent of response.body.data.agents) {
      for (const cap of agent.capabilities as string[]) {
        expect(allowlist).toContain(cap);
      }
    }

    // Reset to restore clean state for subsequent tests
    agentsService.reset();
  });

  it("returns seeded agents so contributors can inspect a real module", async () => {
    const response = await request(app).get("/api/v1/agents");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.total).toBe(1);
    expect(response.body.data.agents[0]).toMatchObject({
      id: "agentlily_demo_001",
      name: "Treasury Settlement Agent",
      walletAddress: expect.stringMatching(/^G[A-Z0-9]+$/),
      status: "active",
    });
  });

  it("returns a list envelope whose total matches the number of agents", async () => {
    const response = await request(app).get("/api/v1/agents");

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(Array.isArray(response.body.data.agents)).toBe(true);
    expect(response.body.data.total).toBe(response.body.data.agents.length);
  });

  it("creates an agent with validated input", async () => {
    const response = await request(app)
      .post("/api/v1/agents")
      .send({
        name: "Liquidity Bot",
        description:
          "AgentLily responsible for orchestrating liquidity and payment workflows.",
        capabilities: ["usdc-payments", "payments"],
      });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.agent).toMatchObject({
      id: "agentlily_2",
      name: "Liquidity Bot",
      description:
        "AgentLily responsible for orchestrating liquidity and payment workflows.",
      status: "active",
      capabilities: ["usdc-payments", "payments"],
    });
    expect(response.body.data.agent.walletAddress).toMatch(/^GLIQUIDITYBOT0+/);
  });

  it("persists a created agent in the list endpoint", async () => {
    await request(app)
      .post("/api/v1/agents")
      .send({
        name: "Marketplace Runner",
        description:
          "AgentLily responsible for purchasing tools and settling marketplace invoices.",
        capabilities: ["settlement", "settlement"],
      });

    const response = await request(app).get("/api/v1/agents");

    expect(response.status).toBe(200);
    expect(response.body.data.total).toBe(3);
    expect(
      response.body.data.agents.map((agent: { id: string }) => agent.id),
    ).toEqual(["agentlily_demo_001", "agentlily_2", "agentlily_3"]);
    expect(response.body.data.agents[2]).toMatchObject({
      name: "Marketplace Runner",
      capabilities: ["settlement"],
    });
  });

  it("rejects unknown keys in agent creation payloads", async () => {
    const response = await request(app)
      .post("/api/v1/agents")
      .send({
        name: "Treasury Bot",
        description:
          "AgentLily responsible for treasury management and payment routing.",
        capabilities: ["treasury-management"],
        admin: true,
      });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Request validation failed");
    expect(response.body.details.fieldErrors).toMatchObject({
      admin: [expect.stringContaining("Unrecognized key")],
    });
  });

  it("rejects invalid agent payloads with typed validation errors", async () => {
    const response = await request(app).post("/api/v1/agents").send({
      name: "A",
      description: "too short",
      capabilities: [],
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.code).toBe("VALIDATION_ERROR");
    expect(response.body.message).toBe("Request validation failed");
    expect(response.body.details.fieldErrors).toMatchObject({
      name: [expect.any(String)],
      description: [expect.any(String)],
      capabilities: [expect.any(String)],
    });
  });

  it("pauses an existing agent", async () => {
    const response = await request(app)
      .patch("/api/v1/agents/agentlily_demo_001")
      .send({ status: "paused" });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.agent.id).toBe("agentlily_demo_001");
    expect(response.body.data.agent.status).toBe("paused");
  });

  it("resumes the same agent", async () => {
    await request(app)
      .patch("/api/v1/agents/agentlily_demo_001")
      .send({ status: "active" });

    const response = await request(app)
      .patch("/api/v1/agents/agentlily_demo_001")
      .send({ status: "active" });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.agent.status).toBe("active");
  });

  it("rejects invalid status with 400", async () => {
    const response = await request(app)
      .patch("/api/v1/agents/agentlily_demo_001")
      .send({ status: "disabled" });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe("Request validation failed");
  });

  it("returns 404 for unknown agent ID", async () => {
    const response = await request(app)
      .patch("/api/v1/agents/does-not-exist")
      .send({ status: "paused" });

    expect(response.status).toBe(404);
    expect(response.body.success).toBe(false);
  });

  it("persists status change in the list endpoint", async () => {
    await request(app)
      .patch("/api/v1/agents/agentlily_demo_001")
      .send({ status: "paused" });

    const response = await request(app).get("/api/v1/agents");

    expect(response.status).toBe(200);
    expect(response.body.data.agents[0]).toMatchObject({
      id: "agentlily_demo_001",
      status: "paused",
    });
  });

  describe("pagination (issue #265)", () => {
    it("returns at most the requested limit of agents with total reflecting the full store size", async () => {
      agentsService.reset();
      // Create additional agents so we have at least 3
      await request(app)
        .post("/api/v1/agents")
        .send({
          name: "Agent Two",
          description:
            "Second test agent for testing limit and offset pagination.",
          capabilities: ["settlement"],
        });
      await request(app)
        .post("/api/v1/agents")
        .send({
          name: "Agent Three",
          description:
            "Third test agent for testing limit and offset pagination.",
          capabilities: ["settlement"],
        });

      const response = await request(app).get("/api/v1/agents?limit=2&offset=0");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.agents).toHaveLength(2);
      expect(response.body.data.total).toBe(3);
    });

    it("returns an empty agents array with correct total when offset is beyond store size", async () => {
      const response = await request(app).get("/api/v1/agents?limit=10&offset=50");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.agents).toHaveLength(0);
      expect(response.body.data.total).toBeGreaterThan(0);
    });

    it("rejects limit above 100 with 400 and validation envelope", async () => {
      const response = await request(app).get("/api/v1/agents?limit=101");

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Request validation failed");
    });

    it("rejects negative limit with 400 and validation envelope", async () => {
      const response = await request(app).get("/api/v1/agents?limit=-1");

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Request validation failed");
    });

    it("rejects negative offset with 400 and validation envelope", async () => {
      const response = await request(app).get("/api/v1/agents?offset=-1");

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe("Request validation failed");
    });
  });
});
