import { describe, it, expect, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { capabilityEnum } from "../src/modules/agents/agents.schema";
import { agentsService } from "../src/modules/agents/agents.service";

describe("Restrict agent capabilities to allowlist enum (issue #75)", () => {
  const app = createApp();

  beforeEach(() => {
    agentsService.reset?.();
  });

  it("should accept all known seed capabilities", async () => {
    const res = await request(app)
      .post("/api/v1/agents")
      .send({
        name: "Seed Caps Agent",
        description: "Testing that all seed capabilities are accepted",
        capabilities: ["wallet-provisioning", "usdc-payments", "settlement"],
      });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.agent.capabilities).toEqual([
      "wallet-provisioning",
      "usdc-payments",
      "settlement",
    ]);
  });

  it("should reject unknown capability strings with 400", async () => {
    const res = await request(app)
      .post("/api/v1/agents")
      .send({
        name: "Bad Caps Agent",
        description: "Testing rejection of unknown capability values",
        capabilities: ["drop-tables", "exfil"],
      });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("should reject mixed valid and invalid capabilities", async () => {
    const res = await request(app)
      .post("/api/v1/agents")
      .send({
        name: "Mixed Caps Agent",
        description: "Testing rejection when one capability is invalid",
        capabilities: ["payments", "malicious-action"],
      });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("should still deduplicate valid capabilities", async () => {
    const res = await request(app)
      .post("/api/v1/agents")
      .send({
        name: "Dedup Caps Agent",
        description: "Testing deduplication still works with allowlist",
        capabilities: ["payments", "payments", "settlement"],
      });
    expect(res.status).toBe(201);
    expect(res.body.data.agent.capabilities).toEqual(["payments", "settlement"]);
  });

  it("GET /api/v1/agents returns only capabilityEnum values for the seed", async () => {
    const res = await request(app).get("/api/v1/agents");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const allowed = capabilityEnum.options;
    const agents = res.body.data.agents as Array<{ id: string; capabilities: string[] }>;

    for (const agent of agents) {
      for (const capability of agent.capabilities) {
        expect(allowed).toContain(capability);
      }
    }

    const seed = agents.find((agent) => agent.id === "agentlily_demo_001");
    expect(seed).toBeDefined();
    expect(seed?.capabilities).toEqual(["settlement"]);
  });

  it("GET /api/v1/agents returns only capabilityEnum values after creating an agent", async () => {
    const createRes = await request(app)
      .post("/api/v1/agents")
      .send({
        name: "Allowlisted Caps Agent",
        description: "Testing listed capabilities stay on the allowlist",
        capabilities: ["settlement", "payments"],
      });
    expect(createRes.status).toBe(201);

    const res = await request(app).get("/api/v1/agents");
    expect(res.status).toBe(200);

    const allowed = capabilityEnum.options;
    const agents = res.body.data.agents as Array<{ capabilities: string[] }>;

    for (const agent of agents) {
      for (const capability of agent.capabilities) {
        expect(allowed).toContain(capability);
      }
    }
  });
});
