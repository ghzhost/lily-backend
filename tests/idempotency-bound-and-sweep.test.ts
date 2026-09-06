import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createApp } from "../src/app";
import {
  clearIdempotencyStore,
  configureIdempotencyStore,
  getIdempotencyStoreSize,
  sweepExpiredEntries,
} from "../src/common/http/idempotency.middleware";
import { agentsService } from "../src/modules/agents/agents.service";

const app = createApp();

describe("Idempotency store bound and sweep (issue #288)", () => {
  beforeEach(() => {
    clearIdempotencyStore();
    agentsService.reset();
  });

  it("evicts oldest entries when capacity limit is reached", async () => {
    // Set cap to 3 items
    configureIdempotencyStore({ maxCapacity: 3 });

    for (let i = 1; i <= 4; i++) {
      await request(app)
        .post("/api/v1/agents")
        .set("Idempotency-Key", `key-${i}`)
        .send({
          name: `Agent ${i}`,
          description: `Description for agent ${i}`,
          capabilities: ["testing"],
        })
        .expect(201);
    }

    expect(getIdempotencyStoreSize()).toBe(3);

    // key-1 should have been evicted (oldest-first)
    // Sending key-1 again creates a NEW agent rather than replaying
    const replayFirst = await request(app)
      .post("/api/v1/agents")
      .set("Idempotency-Key", "key-1")
      .send({
        name: "Agent 1 New",
        description: "Description for agent 1 new",
        capabilities: ["testing"],
      })
      .expect(201);

    expect(replayFirst.body.data.agent.name).toBe("Agent 1 New");

    // key-4 should still be cached and replayed
    const replayFourth = await request(app)
      .post("/api/v1/agents")
      .set("Idempotency-Key", "key-4")
      .send({
        name: "Agent 4 Replay",
        description: "Description for agent 4 replay",
        capabilities: ["testing"],
      })
      .expect(201);

    expect(replayFourth.body.data.agent.name).toBe("Agent 4");
  });

  it("proactively sweeps entries older than TTL", async () => {
    // Set TTL to 100ms
    configureIdempotencyStore({ ttlMs: 100 });

    const startTime = 1_000_000;
    vi.spyOn(Date, "now").mockReturnValue(startTime);

    await request(app)
      .post("/api/v1/agents")
      .set("Idempotency-Key", "expiring-key")
      .send({
        name: "Expiring Agent",
        description: "Agent to test proactive sweep",
        capabilities: ["testing"],
      })
      .expect(201);

    expect(getIdempotencyStoreSize()).toBe(1);

    // Advance time past TTL
    const evicted = sweepExpiredEntries(startTime + 150);
    expect(evicted).toBe(1);
    expect(getIdempotencyStoreSize()).toBe(0);

    vi.restoreAllMocks();
  });
});
