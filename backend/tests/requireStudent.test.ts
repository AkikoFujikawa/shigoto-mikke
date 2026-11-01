import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findStudent: vi.fn(),
}));

vi.mock("../src/lib/prisma.js", () => ({
  prisma: {
    student: { findUnique: mocks.findStudent },
  },
}));

import { issueStudentToken } from "../src/lib/sessionToken.js";
import { handleUnexpectedError } from "../src/middlewares/errorHandler.js";
import { requireStudent } from "../src/middlewares/requireStudent.js";

const SECRET = "test-session-secret";
const UNAUTHORIZED_BODY = {
  error: { code: "UNAUTHORIZED", message: "もう一度はじめからお試しください" },
};

function createTestApp() {
  const app = express();
  app.get("/protected", requireStudent, (req, res) => {
    res.status(200).json({ student: req.student });
  });
  app.use(handleUnexpectedError);
  return app;
}

function signWith(payload: object, options: jwt.SignOptions = {}, secret = SECRET): string {
  return jwt.sign(payload, secret, { algorithm: "HS256", expiresIn: "8h", ...options });
}

describe("requireStudent", () => {
  beforeEach(() => {
    vi.stubEnv("SESSION_SECRET", SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("正しいトークンで、DBの生徒と一致すれば次の処理に進み、生徒ID・学校IDを渡す", async () => {
    mocks.findStudent.mockResolvedValue({ id: 101, schoolId: 7 });
    const token = issueStudentToken({ studentId: 101, schoolId: 7 });

    const res = await request(createTestApp())
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ student: { id: 101, schoolId: 7 } });
    expect(mocks.findStudent).toHaveBeenCalledWith({
      where: { id: 101 },
      select: { id: true, schoolId: true },
    });
  });

  it.each([
    ["Authorization ヘッダーが無い", () => undefined],
    ["Bearer 形式でない", () => "Basic abc"],
    [
      "別の鍵で署名されている",
      () =>
        `Bearer ${signWith({ schoolId: 7, role: "student" }, { subject: "101" }, "other-secret")}`,
    ],
    [
      "有効期限が切れている",
      () =>
        `Bearer ${jwt.sign(
          { schoolId: 7, role: "student", exp: Math.floor(Date.now() / 1000) - 60 },
          SECRET,
          { algorithm: "HS256", subject: "101" },
        )}`,
    ],
    [
      "HS256 以外のアルゴリズム",
      () =>
        `Bearer ${signWith({ schoolId: 7, role: "student" }, { subject: "101", algorithm: "HS512" })}`,
    ],
    [
      "ロールが student でない",
      () => `Bearer ${signWith({ schoolId: 7, role: "school_admin" }, { subject: "101" })}`,
    ],
    ["sub が無い", () => `Bearer ${signWith({ schoolId: 7, role: "student" })}`],
    [
      "sub が数字でない",
      () => `Bearer ${signWith({ schoolId: 7, role: "student" }, { subject: "abc" })}`,
    ],
    ["schoolId が無い", () => `Bearer ${signWith({ role: "student" }, { subject: "101" })}`],
    [
      "schoolId が文字列",
      () => `Bearer ${signWith({ schoolId: "7", role: "student" }, { subject: "101" })}`,
    ],
  ])("%s場合は、DBを見ずに 401 UNAUTHORIZED を返す", async (_label, buildHeader) => {
    const header = buildHeader();
    const req = request(createTestApp()).get("/protected");
    const res = header ? await req.set("Authorization", header) : await req;

    expect(res.status).toBe(401);
    expect(res.body).toEqual(UNAUTHORIZED_BODY);
    expect(mocks.findStudent).not.toHaveBeenCalled();
  });

  it("トークンは正しいが、生徒がDBに存在しない場合は 401 を返す", async () => {
    mocks.findStudent.mockResolvedValue(null);
    const token = issueStudentToken({ studentId: 101, schoolId: 7 });

    const res = await request(createTestApp())
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(res.body).toEqual(UNAUTHORIZED_BODY);
  });

  it("トークンの schoolId とDBの schoolId が一致しない場合は 401 を返す", async () => {
    mocks.findStudent.mockResolvedValue({ id: 101, schoolId: 8 });
    const token = issueStudentToken({ studentId: 101, schoolId: 7 });

    const res = await request(createTestApp())
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(401);
    expect(res.body).toEqual(UNAUTHORIZED_BODY);
  });

  it("SESSION_SECRET が未設定の場合は、401 ではなく 500 を返す(設定ミスを隠さない)", async () => {
    const token = issueStudentToken({ studentId: 101, schoolId: 7 });
    vi.stubEnv("SESSION_SECRET", "");

    const res = await request(createTestApp())
      .get("/protected")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_ERROR");
  });
});
