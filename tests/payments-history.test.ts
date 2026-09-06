import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";

import { createApp } from "../src/app";
import { paymentsService } from "../src/modules/payments/payments.service";

describe("GET /api/v1/payments (payments history - issue #279)", () => {
  const app = createApp();

  beforeEach(() => {
    paymentsService.reset();
  });

  it("returns 200 with empty payments list and total 0 when no payments have executed", async () => {
    const res = await request(app).get("/api/v1/payments");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      success: true,
      data: {
        total: 0,
        payments: [],
      },
    });
  });

  it("returns settled payment in payments history after execution with total === 1", async () => {
    const quoteRes = await request(app).post("/api/v1/payments").send({
      sourceAsset: "USDC",
      destinationAsset: "XLM",
      sourceAmount: "100.00",
    });
    expect(quoteRes.status).toBe(201);
    const quoteId = quoteRes.body.data.quote.id;

    const execRes = await request(app).post("/api/v1/payments/execute").send({
      quoteId,
      confirmed: true,
    });
    expect(execRes.status).toBe(200);
    const settledPayment = execRes.body.data.payment;

    const historyRes = await request(app).get("/api/v1/payments");
    expect(historyRes.status).toBe(200);
    expect(historyRes.body.success).toBe(true);
    expect(historyRes.body.data.total).toBe(1);
    expect(historyRes.body.data.payments).toHaveLength(1);
    expect(historyRes.body.data.payments[0]).toEqual(settledPayment);
    expect(historyRes.body.data.payments[0].status).toBe("settled");
  });

  it("returns a defensive copy so mutating result does not corrupt internal state", async () => {
    const quote = paymentsService.createQuote({
      sourceAsset: "USDC",
      destinationAsset: "XLM",
      sourceAmount: "50",
    });
    paymentsService.executePayment({
      quoteId: quote.quote.id,
      confirmed: true,
    });

    const first = paymentsService.listPayments();
    expect(first.total).toBe(1);

    first.payments.pop();

    const second = paymentsService.listPayments();
    expect(second.total).toBe(1);
    expect(second.payments).toHaveLength(1);
  });
});
