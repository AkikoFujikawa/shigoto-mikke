import express from "express";
import { body } from "express-validator";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { handleValidationErrors } from "./validate.js";

describe("handleValidationErrors", () => {
  const app = express();
  app.use(express.json());
  app.post(
    "/test",
    body("name").isString().bail().notEmpty(),
    handleValidationErrors,
    (_req, res) => {
      res.status(200).json({ ok: true });
    },
  );

  it("入力が不正なとき、API設計§4の形式で400を返す", async () => {
    const res = await request(app).post("/test").send({});

    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      error: {
        code: "VALIDATION_ERROR",
        message: "入力内容を確認してください",
        details: [{ field: "name", message: expect.any(String) }],
      },
    });
  });

  it("入力が正しいとき、次の処理に進む", async () => {
    const res = await request(app).post("/test").send({ name: "テスト" });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});
