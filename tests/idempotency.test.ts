import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../src/app";
import { clearIdempotencyStore } from "../src/common/http/idempotency.middleware";
import { agentsService } from "../src/modules/agents/agents.service";

const app = createApp();

describe("Idempotency-Key middleware", () => {
  beforeEach(() => {
    clearIdempotencyStore();
    agentsService.reset();
  });

  it("returns the original agent on replay with same key", async () => {
    const payload = {
      name: "Test Agent",
      description: "A test agent for idempotency checks",
      capabilities: ["testing"],
    };

    const first = await request(app)
      .post("/api/v1/agents")
      .set("Idempotency-Key", "key-001")
      .send(payload)
      .expect(201);

    const second = await request(app)
      .post("/api/v1/agents")
      .set("Idempotency-Key", "key-001")
      .send(payload)
      .expect(201);

    expect(second.body).toEqual(first.body);
    expect(second.body.data.agent.id).toBe(first.body.data.agent.id);

    const list = await request(app).get("/api/v1/agents").expect(200);
    expect(list.body.data.total).toBe(2);
  });

  it("creates separate agents when no key is provided", async () => {
    const payload = {
      name: "No Key Agent",
      description: "An agent without idempotency key header",
      capabilities: ["testing"],
    };

    const first = await request(app)
      .post("/api/v1/agents")
      .send(payload)
      .expect(201);

    const second = await request(app)
      .post("/api/v1/agents")
      .send(payload)
      .expect(201);

    expect(second.body.data.agent.id).not.toBe(first.body.data.agent.id);

    const list = await request(app).get("/api/v1/agents").expect(200);
    expect(list.body.data.total).toBe(3);
  });

  it("creates separate agents with different keys", async () => {
    const payload = {
      name: "Diff Key Agent",
      description: "An agent with different idempotency keys",
      capabilities: ["testing"],
    };

    const first = await request(app)
      .post("/api/v1/agents")
      .set("Idempotency-Key", "key-alpha")
      .send(payload)
      .expect(201);

    const second = await request(app)
      .post("/api/v1/agents")
      .set("Idempotency-Key", "key-beta")
      .send(payload)
      .expect(201);

    expect(second.body.data.agent.id).not.toBe(first.body.data.agent.id);
  });

  it("does not cache error responses", async () => {
    const badPayload = {
      name: "x",
      description: "too short",
      capabilities: [],
    };

    await request(app)
      .post("/api/v1/agents")
      .set("Idempotency-Key", "key-err")
      .send(badPayload)
      .expect(400);

    await request(app)
      .post("/api/v1/agents")
      .set("Idempotency-Key", "key-err")
      .send(badPayload)
      .expect(400);
  });

  it("ignores idempotency on GET requests (no caching)", async () => {
    await request(app)
      .get("/api/v1/agents")
      .set("Idempotency-Key", "key-get")
      .expect(200);

    await request(app)
      .get("/api/v1/agents")
      .set("Idempotency-Key", "key-get")
      .expect(200);
  });

  it("does not cache 4xx error responses and allows retry with corrected payload (issue #284)", async () => {
    const key = "key-err-retry-001";
    const badPayload = {
      name: "x",
      description: "too short",
      capabilities: [],
    };
    const validPayload = {
      name: "Valid Agent",
      description: "A valid agent description for retry test",
      capabilities: ["testing"],
    };

    // First attempt fails schema validation with 400
    const errRes = await request(app)
      .post("/api/v1/agents")
      .set("Idempotency-Key", key)
      .send(badPayload)
      .expect(400);

    expect(errRes.body.success).toBe(false);

    // Second attempt with SAME key and valid payload succeeds with 201
    const successRes = await request(app)
      .post("/api/v1/agents")
      .set("Idempotency-Key", key)
      .send(validPayload)
      .expect(201);

    expect(successRes.body.success).toBe(true);
    expect(successRes.body.data.agent.name).toBe("Valid Agent");

    // Third attempt with SAME key replays cached 201 response
    const replayRes = await request(app)
      .post("/api/v1/agents")
      .set("Idempotency-Key", key)
      .send(validPayload)
      .expect(201);

    expect(replayRes.body).toEqual(successRes.body);
    expect(replayRes.body.data.agent.id).toBe(successRes.body.data.agent.id);

    // Verify only 1 agent was created (plus 1 seed agent = 2 total)
    const listRes = await request(app).get("/api/v1/agents").expect(200);
    expect(listRes.body.data.total).toBe(2);
  });

  it("bounds the store capacity and evicts oldest entries first (issue #288)", async () => {
    const { _setIdempotencyConfig, _getIdempotencyStoreSize } = await import(
      "../src/common/http/idempotency.middleware"
    );
    _setIdempotencyConfig({ maxEntries: 2 });

    const p1 = {
      name: "Agent One",
      description: "A valid description for agent one",
      capabilities: ["testing"],
    };
    const p2 = {
      name: "Agent Two",
      description: "A valid description for agent two",
      capabilities: ["testing"],
    };
    const p3 = {
      name: "Agent Three",
      description: "A valid description for agent three",
      capabilities: ["testing"],
    };

    // Insert key-1 and key-2
    const res1 = await request(app).post("/api/v1/agents").set("Idempotency-Key", "k1").send(p1).expect(201);
    const res2 = await request(app).post("/api/v1/agents").set("Idempotency-Key", "k2").send(p2).expect(201);
    expect(_getIdempotencyStoreSize()).toBe(2);

    // Insert key-3 -> capacity reached, evicts oldest (k1)
    await request(app).post("/api/v1/agents").set("Idempotency-Key", "k3").send(p3).expect(201);
    expect(_getIdempotencyStoreSize()).toBe(2);

    // Replay k2 -> still cached
    const replay2 = await request(app).post("/api/v1/agents").set("Idempotency-Key", "k2").send(p2).expect(201);
    expect(replay2.body.data.agent.id).toBe(res2.body.data.agent.id);

    // Replay k1 -> evicted, creates a NEW agent
    const replay1 = await request(app).post("/api/v1/agents").set("Idempotency-Key", "k1").send(p1).expect(201);
    expect(replay1.body.data.agent.id).not.toBe(res1.body.data.agent.id);
  });

  it("proactively sweeps expired entries even without replays (issue #288)", async () => {
    const { _setIdempotencyConfig, _getIdempotencyStoreSize, _sweepIdempotencyStore } = await import(
      "../src/common/http/idempotency.middleware"
    );
    _setIdempotencyConfig({ ttlMs: 40 });

    const p = {
      name: "Sweep Agent",
      description: "A valid description for sweep agent",
      capabilities: ["testing"],
    };
    await request(app).post("/api/v1/agents").set("Idempotency-Key", "k-sweep").send(p).expect(201);
    expect(_getIdempotencyStoreSize()).toBe(1);

    await new Promise((r) => setTimeout(r, 60));

    const evictedCount = _sweepIdempotencyStore();
    expect(evictedCount).toBe(1);
    expect(_getIdempotencyStoreSize()).toBe(0);
  });
});
