import express from "express";
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findStudent: vi.fn(),
  findAdmin: vi.fn(),
  verifyIdToken: vi.fn(),
  getApps: vi.fn(),
  initializeApp: vi.fn(),
  cert: vi.fn(),
}));

vi.mock("../src/lib/prisma.js", () => ({
  prisma: {
    student: { findUnique: mocks.findStudent },
    schoolAdmin: { findUnique: mocks.findAdmin },
  },
}));

vi.mock("firebase-admin/app", () => ({
  getApps: mocks.getApps,
  initializeApp: mocks.initializeApp,
  cert: mocks.cert,
}));

vi.mock("firebase-admin/auth", () => ({
  getAuth: () => ({ verifyIdToken: mocks.verifyIdToken }),
}));

vi.mock("../src/config/logger.js", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { handleUnexpectedError } from "../src/middlewares/errorHandler.js";
import { meRouter } from "../src/routes/me.routes.js";
import { makeStudentToken, TEST_SESSION_SECRET } from "./helpers/studentToken.js";

// Firebase の ID トークンに見立てた JWT。role を持たないので、管理者側に振り分けられる
const FIREBASE_LIKE_TOKEN = jwt.sign({ sub: "uid-1" }, "firebase-dummy-key");

function createTestApp() {
  const app = express();
  app.use("/v1", meRouter);
  app.use(handleUnexpectedError);
  return app;
}

describe("GET /v1/me", () => {
  beforeEach(() => {
    vi.stubEnv("SESSION_SECRET", TEST_SESSION_SECRET);
    vi.stubEnv("FIREBASE_PROJECT_ID", "test-project");
    vi.stubEnv("FIREBASE_CLIENT_EMAIL", "admin@test-project.iam.gserviceaccount.com");
    vi.stubEnv("FIREBASE_PRIVATE_KEY", "dummy-key");
    mocks.getApps.mockReturnValue([]);
    mocks.cert.mockReturnValue({});
    mocks.findStudent.mockImplementation(async ({ select }: { select: { nickname?: boolean } }) =>
      select.nickname ? { nickname: "みさき" } : { id: 101, schoolId: 7 },
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("生徒トークンなら、ロール・ID・学校ID・ニックネームを返し、Firebase は呼ばない", async () => {
    const res = await request(createTestApp())
      .get("/v1/me")
      .set("Authorization", `Bearer ${makeStudentToken(101, 7)}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ role: "student", id: 101, schoolId: 7, nickname: "みさき" });
    expect(mocks.initializeApp).not.toHaveBeenCalled();
    expect(mocks.verifyIdToken).not.toHaveBeenCalled();
  });

  it("Firebase の ID トークンで、管理者がDBに登録されていれば、ロール・ID・学校IDを返す", async () => {
    mocks.verifyIdToken.mockResolvedValue({ uid: "uid-1" });
    mocks.findAdmin.mockResolvedValue({ id: 5, schoolId: 7 });

    const res = await request(createTestApp())
      .get("/v1/me")
      .set("Authorization", `Bearer ${FIREBASE_LIKE_TOKEN}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ role: "school_admin", id: 5, schoolId: 7 });
    expect(mocks.findStudent).not.toHaveBeenCalled();
  });

  it("Authorization ヘッダーが無ければ 401 を返す", async () => {
    const res = await request(createTestApp()).get("/v1/me");

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("JWT ではない文字列は、Firebase を使わずその場で 401 を返す", async () => {
    vi.stubEnv("FIREBASE_PRIVATE_KEY", "");

    const res = await request(createTestApp()).get("/v1/me").set("Authorization", "Bearer garbage");

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
    expect(mocks.initializeApp).not.toHaveBeenCalled();
    expect(mocks.verifyIdToken).not.toHaveBeenCalled();
  });

  it("Firebase に回した JWT の検証に失敗したら 401 を返す", async () => {
    mocks.verifyIdToken.mockRejectedValue(new Error("invalid"));

    const res = await request(createTestApp())
      .get("/v1/me")
      .set("Authorization", `Bearer ${FIREBASE_LIKE_TOKEN}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });

  it("別の鍵で署名された生徒風のトークンは、Firebase を使わず 401 を返す", async () => {
    const forged = jwt.sign({ schoolId: 7, role: "student" }, "other-secret", {
      algorithm: "HS256",
      subject: "101",
    });

    const res = await request(createTestApp())
      .get("/v1/me")
      .set("Authorization", `Bearer ${forged}`);

    expect(res.status).toBe(401);
    expect(mocks.findStudent).not.toHaveBeenCalled();
    expect(mocks.verifyIdToken).not.toHaveBeenCalled();
  });

  it("期限切れの生徒トークンは、Firebase が未設定でも 500 でなく 401 を返す", async () => {
    vi.stubEnv("FIREBASE_PROJECT_ID", "");
    vi.stubEnv("FIREBASE_CLIENT_EMAIL", "");
    vi.stubEnv("FIREBASE_PRIVATE_KEY", "");
    const expired = jwt.sign({ schoolId: 7, role: "student" }, TEST_SESSION_SECRET, {
      algorithm: "HS256",
      subject: "101",
      expiresIn: -10,
    });

    const res = await request(createTestApp())
      .get("/v1/me")
      .set("Authorization", `Bearer ${expired}`);

    expect(res.status).toBe(401);
    expect(mocks.initializeApp).not.toHaveBeenCalled();
    expect(mocks.verifyIdToken).not.toHaveBeenCalled();
  });

  it("role を student と偽った Firebase のトークンは、生徒として検証されて 401 になる", async () => {
    const disguised = jwt.sign({ sub: "uid-1", role: "student" }, "firebase-dummy-key");

    const res = await request(createTestApp())
      .get("/v1/me")
      .set("Authorization", `Bearer ${disguised}`);

    expect(res.status).toBe(401);
    expect(mocks.verifyIdToken).not.toHaveBeenCalled();
  });

  it("管理者の /me は、SESSION_SECRET が未設定でも動く", async () => {
    vi.stubEnv("SESSION_SECRET", "");
    mocks.verifyIdToken.mockResolvedValue({ uid: "uid-1" });
    mocks.findAdmin.mockResolvedValue({ id: 5, schoolId: 7 });

    const res = await request(createTestApp())
      .get("/v1/me")
      .set("Authorization", `Bearer ${FIREBASE_LIKE_TOKEN}`);

    expect(res.status).toBe(200);
  });

  it("Firebase のトークンは正しくても管理者として未登録なら 403 を返す", async () => {
    mocks.verifyIdToken.mockResolvedValue({ uid: "unknown-uid" });
    mocks.findAdmin.mockResolvedValue(null);

    const res = await request(createTestApp())
      .get("/v1/me")
      .set("Authorization", `Bearer ${FIREBASE_LIKE_TOKEN}`);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("認証後に生徒がDBから消えていたら 401 を返す", async () => {
    mocks.findStudent.mockResolvedValueOnce({ id: 101, schoolId: 7 }).mockResolvedValueOnce(null);

    const res = await request(createTestApp())
      .get("/v1/me")
      .set("Authorization", `Bearer ${makeStudentToken(101, 7)}`);

    expect(res.status).toBe(401);
  });

  it("Firebase の設定ミスは、管理者の認証のときだけ 500 になり、生徒の /me には影響しない", async () => {
    vi.stubEnv("FIREBASE_PRIVATE_KEY", "");
    const app = createTestApp();

    const admin = await request(app)
      .get("/v1/me")
      .set("Authorization", `Bearer ${FIREBASE_LIKE_TOKEN}`);
    const student = await request(app)
      .get("/v1/me")
      .set("Authorization", `Bearer ${makeStudentToken(101, 7)}`);

    expect(admin.status).toBe(500);
    expect(student.status).toBe(200);
  });
});
