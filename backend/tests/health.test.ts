import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

describe("GET /v1/health", () => {
  it("200 と status ok を返す", async () => {
    const app = createApp();
    const res = await request(app).get("/v1/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});
