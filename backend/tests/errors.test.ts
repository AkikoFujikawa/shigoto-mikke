import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";

describe("共通エラーレスポンス（#71）", () => {
  it("存在しない URL（GET）は、HTML ではなく JSON の 404 NOT_FOUND を返す", async () => {
    const res = await request(createApp()).get("/v1/nope");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: { code: "NOT_FOUND", message: "見つかりませんでした" },
    });
  });

  it("存在しない URL（POST）も、同じく 404 NOT_FOUND を返す", async () => {
    const res = await request(createApp()).post("/v1/nope");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: { code: "NOT_FOUND", message: "見つかりませんでした" },
    });
  });

  it("壊れた JSON を送ったときは、500 ではなく 400 VALIDATION_ERROR を返す", async () => {
    const res = await request(createApp())
      .post("/v1/students/session")
      .set("Content-Type", "application/json")
      .send('{"schoolCode": "DEMO');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: { code: "VALIDATION_ERROR", message: "入力内容を確認してください" },
    });
  });

  it("存在する URL（/v1/health）は、これまでどおり 200 を返す（受け皿が横取りしない）", async () => {
    const res = await request(createApp()).get("/v1/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});
