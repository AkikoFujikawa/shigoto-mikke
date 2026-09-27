const mocks = vi.hoisted(() => ({
  findStudent: vi.fn(),
}));

vi.mock("../src/lib/prisma.js", () => ({
  prisma: {
    student: { findUnique: mocks.findStudent },
  },
}));

import jwt from "jsonwebtoken";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";

const SECRET = "test-session-secret";

function makeStudentToken(studentId: number, schoolId: number): string {
  return jwt.sign({ schoolId, role: "student" }, SECRET, {
    algorithm: "HS256",
    subject: String(studentId),
  });
}

// 正しい形の入力。テストごとに一部だけ壊して使う
const VALID_BODY = {
  interestIds: [1, 4],
  answers: [
    { questionId: 1, optionId: 11 },
    { questionId: 2, optionId: 21 },
    { questionId: 3, optionId: 32 },
    { questionId: 4, optionId: 41 },
    { questionId: 5, optionId: 51 },
  ],
};

describe("POST /v1/diagnoses", () => {
  beforeEach(() => {
    vi.stubEnv("SESSION_SECRET", SECRET);
    mocks.findStudent.mockResolvedValue({ id: 101, schoolId: 7 });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("トークンが無い場合は、401 UNAUTHORIZED を返す", async () => {
    const res = await request(createApp()).post("/v1/diagnoses").send(VALID_BODY);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("interestIds が0個の場合は、400 VALIDATION_ERROR を返す", async () => {
    const res = await request(createApp())
      .post("/v1/diagnoses")
      .set("Authorization", `Bearer ${makeStudentToken(101, 7)}`)
      .send({ ...VALID_BODY, interestIds: [] });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details[0].field).toBe("interestIds");
  });

  it("interestIds が4個の場合は、400 VALIDATION_ERROR を返す", async () => {
    const res = await request(createApp())
      .post("/v1/diagnoses")
      .set("Authorization", `Bearer ${makeStudentToken(101, 7)}`)
      .send({ ...VALID_BODY, interestIds: [1, 2, 3, 4] });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details[0].field).toBe("interestIds");
  });

  it("interestIds に同じIDが2回含まれる場合は、400 VALIDATION_ERROR を返す", async () => {
    const res = await request(createApp())
      .post("/v1/diagnoses")
      .set("Authorization", `Bearer ${makeStudentToken(101, 7)}`)
      .send({ ...VALID_BODY, interestIds: [1, 1] });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details[0].field).toBe("interestIds");
  });

  it("answers が4件の場合は、400 VALIDATION_ERROR を返す", async () => {
    const res = await request(createApp())
      .post("/v1/diagnoses")
      .set("Authorization", `Bearer ${makeStudentToken(101, 7)}`)
      .send({ ...VALID_BODY, answers: VALID_BODY.answers.slice(0, 4) });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details[0].field).toBe("answers");
  });

  it("questionId に同じIDが2回含まれる場合は、400 VALIDATION_ERROR を返す", async () => {
    const res = await request(createApp())
      .post("/v1/diagnoses")
      .set("Authorization", `Bearer ${makeStudentToken(101, 7)}`)
      .send({
        ...VALID_BODY,
        answers: [
          { questionId: 1, optionId: 11 },
          { questionId: 2, optionId: 21 },
          { questionId: 3, optionId: 32 },
          { questionId: 4, optionId: 41 },
          { questionId: 1, optionId: 11 },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details[0].field).toBe("answers");
  });
});
