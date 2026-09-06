import { beforeEach, describe, expect, it } from "vitest";
import { agentsService } from "../src/modules/agents/agents.service";
import { AppError } from "../src/common/http/app-error";
import { errorHandler } from "../src/common/http/error.middleware";

describe("Lily Backend Stress & Hardening Test Suite", () => {
  beforeEach(() => {
    agentsService.reset();
  });

  describe("Agents In-Memory Bounded Capacity", () => {
    it("handles 10,000 agent creations while capping in-memory array to 5,000", () => {
      const initial = agentsService.listAgents();
      expect(initial.total).toBe(1);

      const iterations = 10_000;
      for (let i = 0; i < iterations; i++) {
        agentsService.createAgent({
          name: `Agent Batch ${i}`,
          description: `Orchestrating treasury batch flow for index ${i}`,
          capabilities: ["settlement", "monitoring"],
        });
      }

      const current = agentsService.listAgents();
      expect(current.total).toBeLessThanOrEqual(5_000);
      expect(current.total).toBe(5_000);

      // Verify the latest agent is present
      const latest = agentsService.getAgentById("agentlily_10001");
      expect(latest).toBeDefined();
      expect(latest?.name).toBe("Agent Batch 9999");
      expect(typeof latest?.createdAt).toBe("string");
      expect(typeof latest?.updatedAt).toBe("string");
    });
  });

  describe("Error Middleware Resilience", () => {
    it("handles non-Error objects gracefully without throwing", () => {
      let statusCode = 0;
      let jsonPayload: unknown = null;

      const mockReq = {
        method: "POST",
        originalUrl: "/api/v1/test",
      } as unknown as Parameters<typeof errorHandler>[1];
      const mockRes = {
        status(code: number) {
          statusCode = code;
          return this;
        },
        json(data: unknown) {
          jsonPayload = data;
          return this;
        },
      } as unknown as Parameters<typeof errorHandler>[2];
      const mockNext = (() => {}) as unknown as Parameters<
        typeof errorHandler
      >[3];

      // Test string exception
      errorHandler("Custom string error", mockReq, mockRes, mockNext);
      expect(statusCode).toBe(500);
      expect(jsonPayload as { success: boolean }).toMatchObject({
        success: false,
        message: "Custom string error",
      });

      // Test raw object exception
      errorHandler({ foo: "bar" }, mockReq, mockRes, mockNext);
      expect(statusCode).toBe(500);
      expect(jsonPayload as { success: boolean }).toMatchObject({
        success: false,
        message: "An unexpected error occurred",
      });

      // Test AppError
      const appErr = new AppError(422, "Unprocessable Entity", {
        field: "name",
      });
      errorHandler(appErr, mockReq, mockRes, mockNext);
      expect(statusCode).toBe(422);
      expect(jsonPayload as { success: boolean }).toMatchObject({
        success: false,
        message: "Unprocessable Entity",
        details: { field: "name" },
      });
    });
  });
});
