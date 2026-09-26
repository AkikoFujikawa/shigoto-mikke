import jwt from "jsonwebtoken";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findSchool: vi.fn(),
  createStudent: vi.fn(),
}));

vi.mock("../src/lib/prisma.js", () => ({
  prisma: {
    school: { findUnique: mocks.findSchool },
    student: { create: mocks.createStudent },
  },
}));

import { createApp } from "../src/app.js";

const SECRET = "test-session-secret";

describe("POST /v1/students/session", () => {
  beforeEach(() => {
    vi.stubEnv("SESSION_SECRET", SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("正しい学校コードとニックネームで、201とセッショントークンを返す", async () => {
    mocks.findSchool.mockResolvedValue({ id: 7, name: "上田みらい高等学校" });
    mocks.createStudent.mockResolvedValue({ id: 101, nickname: "みさき" });

    const res = await request(createApp())
      .post("/v1/students/session")
      .send({ schoolCode: "ueda123", nickname: "  みさき  " });

    expect(res.status).toBe(201);
    expect(mocks.findSchool).toHaveBeenCalledWith({
      where: { schoolCode: "UEDA123" },
      select: { id: true, name: true },
    });
    expect(mocks.createStudent).toHaveBeenCalledWith({
      data: { schoolId: 7, nickname: "みさき" },
      select: { id: true, nickname: true },
    });
    expect(res.body).toEqual({
      token: expect.any(String),
      expiresIn: 28800,
      student: { id: 101, nickname: "みさき" },
      school: { name: "上田みらい高等学校" },
    });

    const payload = jwt.verify(res.body.token, SECRET, { algorithms: ["HS256"] }) as jwt.JwtPayload;
    expect(payload.sub).toBe("101");
    expect(payload.schoolId).toBe(7);
    expect(payload.role).toBe("student");
    expect(payload.nickname).toBeUndefined();
    expect(payload.exp! - payload.iat!).toBe(28800);
  });

  it("存在しない学校コードでは、404 SCHOOL_CODE_NOT_FOUND を返し、生徒を作らない", async () => {
    mocks.findSchool.mockResolvedValue(null);

    const res = await request(createApp())
      .post("/v1/students/session")
      .send({ schoolCode: "NOTFOUND", nickname: "みさき" });

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: { code: "SCHOOL_CODE_NOT_FOUND", message: "学校コードが見つかりません" },
    });
    expect(mocks.createStudent).not.toHaveBeenCalled();
  });

  it.each([
    ["学校コードが無い", { nickname: "みさき" }, "schoolCode"],
    ["学校コードが空", { schoolCode: "", nickname: "みさき" }, "schoolCode"],
    ["学校コードに記号を含む", { schoolCode: "UEDA-123", nickname: "みさき" }, "schoolCode"],
    ["学校コードが21文字", { schoolCode: "A".repeat(21), nickname: "みさき" }, "schoolCode"],
    ["ニックネームが無い", { schoolCode: "UEDA123" }, "nickname"],
    ["ニックネームが空白だけ", { schoolCode: "UEDA123", nickname: "   " }, "nickname"],
    ["ニックネームが21文字", { schoolCode: "UEDA123", nickname: "あ".repeat(21) }, "nickname"],
  ])("%s場合は、400 VALIDATION_ERROR を返す", async (_label, body, field) => {
    const res = await request(createApp()).post("/v1/students/session").send(body);

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details).toEqual([{ field, message: expect.any(String) }]);
    expect(mocks.findSchool).not.toHaveBeenCalled();
  });

  it("SESSION_SECRET が未設定の場合は、トークンを発行せず 500 を返す", async () => {
    vi.stubEnv("SESSION_SECRET", "");
    mocks.findSchool.mockResolvedValue({ id: 7, name: "上田みらい高等学校" });
    mocks.createStudent.mockResolvedValue({ id: 101, nickname: "みさき" });

    const res = await request(createApp())
      .post("/v1/students/session")
      .send({ schoolCode: "UEDA123", nickname: "みさき" });

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_ERROR");
    expect(res.body.token).toBeUndefined();
  });
});
