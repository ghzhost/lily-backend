import request from "supertest";
import { createApp } from "../src/app";

describe("POST /api/v1/payments", () => {
  it("returns 201 with active quote envelope", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/v1/payments")
      .send({ sourceAsset: "USDC", destinationAsset: "BRL", sourceAmount: "100" });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      status: "active",
      sourceAsset: "USDC",
      destinationAsset: "BRL",
      sourceAmount: "100",
    });
    expect(res.body.data).toHaveProperty("id");
    expect(res.body.data).toHaveProperty("expiresAt");
    expect(res.body.data).toHaveProperty("destinationAmount");
    expect(res.body.data).toHaveProperty("fee");
    expect(res.body.data).toHaveProperty("rate");
  });
});

describe("GET /api/v1/payments/quotes/:id", () => {
  it("returns 200 for a live quote", async () => {
    const app = createApp();
    const create = await request(app)
      .post("/api/v1/payments")
      .send({ sourceAsset: "USDC", destinationAsset: "BRL", sourceAmount: "50" });
    const id = create.body.data.id;
    const res = await request(app).get(`/api/v1/payments/quotes/${id}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(id);
  });

  it("returns 404 for unknown quote", async () => {
    const app = createApp();
    const res = await request(app).get("/api/v1/payments/quotes/nonexistent");
    expect(res.status).toBe(404);
  });
});

describe("POST /api/v1/payments/execute", () => {
  it("returns 400 when confirmed is false", async () => {
    const app = createApp();
    const create = await request(app)
      .post("/api/v1/payments")
      .send({ sourceAsset: "USDC", destinationAsset: "BRL", sourceAmount: "10" });
    const res = await request(app)
      .post("/api/v1/payments/execute")
      .send({ quoteId: create.body.data.id, confirmed: false });
    expect(res.status).toBe(400);
  });

  it("returns 404 for missing quote", async () => {
    const app = createApp();
    const res = await request(app)
      .post("/api/v1/payments/execute")
      .send({ quoteId: "nonexistent", confirmed: true });
    expect(res.status).toBe(404);
  });

  it("returns 200 with settled payment on success", async () => {
    const app = createApp();
    const create = await request(app)
      .post("/api/v1/payments")
      .send({ sourceAsset: "USDC", destinationAsset: "BRL", sourceAmount: "25" });
    const res = await request(app)
      .post("/api/v1/payments/execute")
      .send({ quoteId: create.body.data.id, confirmed: true });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty("id");
    expect(res.body.data.quoteId).toBe(create.body.data.id);
  });

  it("returns 409 when quote already executed", async () => {
    const app = createApp();
    const create = await request(app)
      .post("/api/v1/payments")
      .send({ sourceAsset: "USDC", destinationAsset: "BRL", sourceAmount: "30" });
    await request(app)
      .post("/api/v1/payments/execute")
      .send({ quoteId: create.body.data.id, confirmed: true });
    const res = await request(app)
      .post("/api/v1/payments/execute")
      .send({ quoteId: create.body.data.id, confirmed: true });
    expect(res.status).toBe(409);
  });
});
