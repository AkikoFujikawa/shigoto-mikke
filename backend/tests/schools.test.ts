import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findSchool: vi.fn(),
  findAdmin: vi.fn(),
  verifyIdToken: vi.fn(),
  getApps: vi.fn(),
  initializeApp: vi.fn(),
  cert: vi.fn(),
}));

vi.mock("../src/lib/prisma.js", () => ({
  prisma: {
    school: { findUnique: mocks.findSchool },
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
import { schoolsRouter } from "../src/routes/schools.routes.js";

const NOW = new Date("2026-10-01T00:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const fromNow = (days: number) => new Date(NOW.getTime() + days * DAY);

const SCHOOL = { id: 7, name: "上田みらい高等学校", schoolCode: "UEDA123" };
const TRIAL = { status: "trial", trialEndsAt: fromNow(18), activeEndsAt: null };

function createTestApp() {
  const app = express();
  app.use("/v1", schoolsRouter);
  app.use(handleUnexpectedError);
  return app;
}

function getSchoolsMe(path = "/v1/schools/me") {
  return request(createTestApp()).get(path).set("Authorization", "Bearer valid-token");
}

describe("GET /v1/schools/me", () => {
  beforeEach(() => {
    // 時刻だけを固定する（タイマーまで偽物にすると supertest の通信が止まるため）
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);
    vi.stubEnv("FIREBASE_PROJECT_ID", "test-project");
    vi.stubEnv("FIREBASE_CLIENT_EMAIL", "admin@test-project.iam.gserviceaccount.com");
    vi.stubEnv("FIREBASE_PRIVATE_KEY", "dummy-key");
    mocks.getApps.mockReturnValue([]);
    mocks.cert.mockReturnValue({});
    mocks.verifyIdToken.mockResolvedValue({ uid: "uid-1" });
    mocks.findAdmin.mockResolvedValue({ id: 5, schoolId: 7 });
    mocks.findSchool.mockResolvedValue({ ...SCHOOL, contract: TRIAL });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  describe("契約状態ごとの応答（API設計 §3.7）", () => {
    it("無料体験中は、学校情報と trial・trialEndsAt・daysLeft を返す", async () => {
      const res = await getSchoolsMe();

      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        school: SCHOOL,
        contract: { status: "trial", trialEndsAt: "2026-10-19T00:00:00.000Z", daysLeft: 18 },
      });
    });

    it("無料体験終了は、trial_expired・trialEndsAt を返し、daysLeft は返さない", async () => {
      mocks.findSchool.mockResolvedValue({
        ...SCHOOL,
        contract: { status: "trial", trialEndsAt: fromNow(-5), activeEndsAt: null },
      });

      const res = await getSchoolsMe();

      expect(res.status).toBe(200);
      expect(res.body.contract).toEqual({
        status: "trial_expired",
        trialEndsAt: "2026-09-26T00:00:00.000Z",
      });
    });

    it("契約中は、active・activeEndsAt だけを返す", async () => {
      mocks.findSchool.mockResolvedValue({
        ...SCHOOL,
        contract: { status: "active", trialEndsAt: fromNow(-60), activeEndsAt: fromNow(335) },
      });

      const res = await getSchoolsMe();

      expect(res.status).toBe(200);
      expect(res.body.contract).toEqual({
        status: "active",
        activeEndsAt: "2027-09-01T00:00:00.000Z",
      });
    });

    it("契約期限切れは、contract_expired・activeEndsAt だけを返す", async () => {
      mocks.findSchool.mockResolvedValue({
        ...SCHOOL,
        contract: { status: "active", trialEndsAt: fromNow(-430), activeEndsAt: fromNow(-35) },
      });

      const res = await getSchoolsMe();

      expect(res.status).toBe(200);
      expect(res.body.contract).toEqual({
        status: "contract_expired",
        activeEndsAt: "2026-08-27T00:00:00.000Z",
      });
    });
  });

  describe("ほかの学校・内部情報を返さない", () => {
    it("学校は認証した管理者の schoolId で探し、返す項目だけを取る", async () => {
      await getSchoolsMe();

      expect(mocks.findSchool).toHaveBeenCalledWith({
        where: { id: 7 },
        select: {
          id: true,
          name: true,
          schoolCode: true,
          contract: { select: { status: true, trialEndsAt: true, activeEndsAt: true } },
        },
      });
    });

    it("URL で別の学校を指定しても、自分の学校だけを探す", async () => {
      await getSchoolsMe("/v1/schools/me?schoolId=99&id=99");

      expect(mocks.findSchool).toHaveBeenCalledTimes(1);
      expect(mocks.findSchool.mock.calls[0][0].where).toEqual({ id: 7 });
    });

    it("DB から余分な項目が返ってきても、Stripe の ID・メールなどは応答に含めない", async () => {
      mocks.findSchool.mockResolvedValue({
        ...SCHOOL,
        createdAt: NOW,
        admins: [{ email: "teacher@example.com", firebaseUid: "uid-1" }],
        contract: {
          ...TRIAL,
          id: 3,
          stripeCustomerId: "cus_secret",
          stripePaymentIntentId: "pi_secret",
          activatedAt: null,
        },
      });

      const res = await getSchoolsMe();

      expect(res.body).toEqual({
        school: SCHOOL,
        contract: { status: "trial", trialEndsAt: "2026-10-19T00:00:00.000Z", daysLeft: 18 },
      });
      expect(JSON.stringify(res.body)).not.toMatch(
        /cus_secret|pi_secret|teacher@example\.com|uid-1/,
      );
    });
  });

  describe("認証", () => {
    it("Authorization ヘッダーが無ければ 401 を返し、学校は探さない", async () => {
      const res = await request(createTestApp()).get("/v1/schools/me");

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
      expect(mocks.findSchool).not.toHaveBeenCalled();
    });

    it("Firebase で検証できないトークン（不正・期限切れ・生徒のトークン）は 401 を返す", async () => {
      mocks.verifyIdToken.mockRejectedValue(new Error("Decoding Firebase ID token failed"));

      const res = await getSchoolsMe();

      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHORIZED");
      expect(mocks.findSchool).not.toHaveBeenCalled();
    });

    it("Firebase のトークンは正しくても管理者として未登録なら 403 を返す", async () => {
      mocks.findAdmin.mockResolvedValue(null);

      const res = await getSchoolsMe();

      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
      expect(mocks.findSchool).not.toHaveBeenCalled();
    });
  });

  describe("データの不整合（seed では起きない）", () => {
    it.each([
      ["契約の行が無い", { ...SCHOOL, contract: null }],
      ["学校の行が無い", null],
      [
        "active なのに activeEndsAt が無い",
        {
          ...SCHOOL,
          contract: { status: "active", trialEndsAt: fromNow(-60), activeEndsAt: null },
        },
      ],
    ])("%s場合は 500 を返し、内部の情報は出さない", async (_name, school) => {
      mocks.findSchool.mockResolvedValue(school);

      const res = await getSchoolsMe();

      expect(res.status).toBe(500);
      expect(res.body).toEqual({
        error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました" },
      });
    });
  });
});
