import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findAdmin: vi.fn(),
  verifyIdToken: vi.fn(),
  getApps: vi.fn(),
  initializeApp: vi.fn(),
  cert: vi.fn(),
}));

vi.mock("../src/lib/prisma.js", () => ({
  prisma: { schoolAdmin: { findUnique: mocks.findAdmin } },
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
import { requireAdmin } from "../src/middlewares/requireAdmin.js";

const UNAUTHORIZED_BODY = {
  error: { code: "UNAUTHORIZED", message: "認証できませんでした。もう一度お試しください" },
};

function createTestApp() {
  const app = express();
  app.get("/protected", requireAdmin, (req, res) => {
    res.status(200).json({ admin: req.admin });
  });
  app.use(handleUnexpectedError);
  return app;
}

describe("requireAdmin", () => {
  beforeEach(() => {
    vi.stubEnv("FIREBASE_PROJECT_ID", "test-project");
    vi.stubEnv("FIREBASE_CLIENT_EMAIL", "admin@test-project.iam.gserviceaccount.com");
    vi.stubEnv("FIREBASE_PRIVATE_KEY", "line1\\nline2");
    mocks.getApps.mockReturnValue([]);
    mocks.cert.mockReturnValue({});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("正しいIDトークンで、管理者がDBに登録されていれば次の処理に進み、管理者ID・学校IDを渡す", async () => {
    mocks.verifyIdToken.mockResolvedValue({ uid: "uid-1" });
    mocks.findAdmin.mockResolvedValue({ id: 5, schoolId: 7 });

    const res = await request(createTestApp())
      .get("/protected")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ admin: { role: "school_admin", id: 5, schoolId: 7 } });
    expect(mocks.verifyIdToken).toHaveBeenCalledWith("valid-token");
    expect(mocks.findAdmin).toHaveBeenCalledWith({
      where: { firebaseUid: "uid-1" },
      select: { id: true, schoolId: true },
    });
  });

  it.each([
    ["Authorization ヘッダーが無い", undefined],
    ["Bearer 形式でない", "Basic abc"],
  ])("%s場合は 401 を返し、Firebase を初期化も呼び出しもしない", async (_name, header) => {
    vi.stubEnv("FIREBASE_PRIVATE_KEY", "");
    const req = request(createTestApp()).get("/protected");

    const res = await (header ? req.set("Authorization", header) : req);

    expect(res.status).toBe(401);
    expect(res.body).toEqual(UNAUTHORIZED_BODY);
    expect(mocks.initializeApp).not.toHaveBeenCalled();
    expect(mocks.verifyIdToken).not.toHaveBeenCalled();
  });

  it("IDトークンの検証に失敗したら 401 を返し、DBは見ない", async () => {
    mocks.verifyIdToken.mockRejectedValue(new Error("Firebase ID token has expired"));

    const res = await request(createTestApp())
      .get("/protected")
      .set("Authorization", "Bearer expired-token");

    expect(res.status).toBe(401);
    expect(res.body).toEqual(UNAUTHORIZED_BODY);
    expect(mocks.findAdmin).not.toHaveBeenCalled();
  });

  it("トークンは正しくても管理者としてDBに未登録なら 403 を返す", async () => {
    mocks.verifyIdToken.mockResolvedValue({ uid: "unknown-uid" });
    mocks.findAdmin.mockResolvedValue(null);

    const res = await request(createTestApp())
      .get("/protected")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: { code: "FORBIDDEN", message: "権限がありません" } });
  });

  it("DBエラーなど想定外の失敗は 500 を返す", async () => {
    mocks.verifyIdToken.mockResolvedValue({ uid: "uid-1" });
    mocks.findAdmin.mockRejectedValue(new Error("db down"));

    const res = await request(createTestApp())
      .get("/protected")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_ERROR");
  });

  it("Firebase の環境変数が未設定なら、初期化せず 500 を返す", async () => {
    vi.stubEnv("FIREBASE_PRIVATE_KEY", "");

    const res = await request(createTestApp())
      .get("/protected")
      .set("Authorization", "Bearer valid-token");

    expect(res.status).toBe(500);
    expect(mocks.initializeApp).not.toHaveBeenCalled();
  });

  it("秘密鍵の \\n を改行に直して初期化し、初期化済みなら再初期化しない", async () => {
    mocks.verifyIdToken.mockResolvedValue({ uid: "uid-1" });
    mocks.findAdmin.mockResolvedValue({ id: 5, schoolId: 7 });
    const app = createTestApp();

    await request(app).get("/protected").set("Authorization", "Bearer t");
    expect(mocks.cert).toHaveBeenCalledWith({
      projectId: "test-project",
      clientEmail: "admin@test-project.iam.gserviceaccount.com",
      privateKey: "line1\nline2",
    });
    expect(mocks.initializeApp).toHaveBeenCalledTimes(1);

    mocks.getApps.mockReturnValue([{}]);
    await request(app).get("/protected").set("Authorization", "Bearer t");
    expect(mocks.initializeApp).toHaveBeenCalledTimes(1);
  });
});
