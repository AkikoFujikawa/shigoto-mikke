import { Prisma } from "@prisma/client";
import express from "express";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from "vitest";

const mocks = vi.hoisted(() => ({
  findContract: vi.fn(),
  createEvent: vi.fn(),
  updateContract: vi.fn(),
  findAdmin: vi.fn(),
  verifyIdToken: vi.fn(),
  getApps: vi.fn(),
  initializeApp: vi.fn(),
  cert: vi.fn(),
}));

vi.mock("../src/lib/prisma.js", () => {
  // トランザクションの中身は、渡された関数をそのまま実行して確かめる
  const tx = {
    stripeEvent: { create: mocks.createEvent },
    contract: { update: mocks.updateContract },
  };
  return {
    prisma: {
      contract: { findUnique: mocks.findContract },
      schoolAdmin: { findUnique: mocks.findAdmin },
      $transaction: (run: (client: typeof tx) => Promise<unknown>) => run(tx),
    },
  };
});

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

import { getStripe } from "../src/lib/stripe.js";
import { handleUnexpectedError } from "../src/middlewares/errorHandler.js";
import { billingRouter, billingWebhookRouter } from "../src/routes/billing.routes.js";

const NOW = new Date("2026-10-10T03:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const fromNow = (days: number) => new Date(NOW.getTime() + days * DAY);

const WEBHOOK_SECRET = "whsec_test_secret";
const CHECKOUT_URL = "https://checkout.stripe.com/c/pay/cs_test_dummy";
const INTERNAL_ERROR_BODY = {
  error: { code: "INTERNAL_ERROR", message: "サーバーエラーが発生しました" },
};

// app.ts と同じ並び（Webhook は express.json() より前）
function createTestApp() {
  const app = express();
  app.use("/v1", billingWebhookRouter);
  app.use(express.json());
  app.use("/v1", billingRouter);
  app.use(handleUnexpectedError);
  return app;
}

let createSession: MockInstance;

beforeEach(() => {
  // 時刻だけを固定する（タイマーまで偽物にすると supertest の通信が止まるため）
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy");
  vi.stubEnv("STRIPE_PRICE_ID", "price_test_dummy");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", WEBHOOK_SECRET);
  vi.stubEnv("FIREBASE_PROJECT_ID", "test-project");
  vi.stubEnv("FIREBASE_CLIENT_EMAIL", "admin@test-project.iam.gserviceaccount.com");
  vi.stubEnv("FIREBASE_PRIVATE_KEY", "dummy-key");
  mocks.getApps.mockReturnValue([]);
  mocks.cert.mockReturnValue({});
  mocks.verifyIdToken.mockResolvedValue({ uid: "uid-1" });
  mocks.findAdmin.mockResolvedValue({ id: 5, schoolId: 7 });
  mocks.findContract.mockResolvedValue({
    status: "trial",
    trialEndsAt: fromNow(18),
    activeEndsAt: null,
  });
  mocks.createEvent.mockResolvedValue({});
  mocks.updateContract.mockResolvedValue({});
  // Stripe には通信しない。署名の検証は、SDK の本物の処理を使う
  createSession = vi
    .spyOn(getStripe().checkout.sessions, "create")
    .mockResolvedValue({ url: CHECKOUT_URL } as never);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe("POST /v1/billing/checkout-session", () => {
  function postCheckout() {
    return request(createTestApp())
      .post("/v1/billing/checkout-session")
      .set("Authorization", "Bearer valid-token");
  }

  it("無料体験中の学校は、Checkout の URL を返す", async () => {
    const res = await postCheckout();

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ url: CHECKOUT_URL });
  });

  it("一括払い・STRIPE_PRICE_ID の価格を1点・学校IDつきで、Checkout を作る（API設計 §3.7）", async () => {
    await postCheckout();

    expect(createSession).toHaveBeenCalledTimes(1);
    expect(createSession).toHaveBeenCalledWith({
      mode: "payment",
      line_items: [{ price: "price_test_dummy", quantity: 1 }],
      client_reference_id: "7",
      success_url: "http://localhost:3000/admin?checkout=success",
      cancel_url: "http://localhost:3000/admin?checkout=cancel",
    });
  });

  it("ボディで別の学校を指定しても、認証した管理者の学校で作る", async () => {
    await postCheckout().send({ schoolId: 99, client_reference_id: "99" });

    expect(mocks.findContract.mock.calls[0][0].where).toEqual({ schoolId: 7 });
    expect(createSession.mock.calls[0][0].client_reference_id).toBe("7");
  });

  it.each([
    ["無料体験終了", { status: "trial", trialEndsAt: fromNow(-5), activeEndsAt: null }],
    ["契約期限切れ", { status: "active", trialEndsAt: fromNow(-430), activeEndsAt: fromNow(-35) }],
  ])("%sの学校も、そのまま申し込める", async (_name, contract) => {
    mocks.findContract.mockResolvedValue(contract);

    const res = await postCheckout();

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ url: CHECKOUT_URL });
  });

  it("契約中（期限内）の学校は 409 ALREADY_SUBSCRIBED を返し、Stripe を呼ばない", async () => {
    mocks.findContract.mockResolvedValue({
      status: "active",
      trialEndsAt: fromNow(-60),
      activeEndsAt: fromNow(335),
    });

    const res = await postCheckout();

    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      error: { code: "ALREADY_SUBSCRIBED", message: "すでに契約中です" },
    });
    expect(createSession).not.toHaveBeenCalled();
  });

  it("Authorization ヘッダーが無ければ 401 を返し、Stripe を呼ばない", async () => {
    const res = await request(createTestApp()).post("/v1/billing/checkout-session");

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
    expect(createSession).not.toHaveBeenCalled();
  });

  it("管理者として未登録なら 403 を返し、Stripe を呼ばない", async () => {
    mocks.findAdmin.mockResolvedValue(null);

    const res = await postCheckout();

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
    expect(createSession).not.toHaveBeenCalled();
  });

  it("契約の行が無い（データの不整合）場合は 500 を返し、Stripe を呼ばない", async () => {
    mocks.findContract.mockResolvedValue(null);

    const res = await postCheckout();

    expect(res.status).toBe(500);
    expect(res.body).toEqual(INTERNAL_ERROR_BODY);
    expect(createSession).not.toHaveBeenCalled();
  });

  it("Stripe の呼び出しに失敗したら 500 を返し、Stripe のエラーの内容は出さない", async () => {
    createSession.mockRejectedValue(new Error("No such price: 'price_test_dummy'"));

    const res = await postCheckout();

    expect(res.status).toBe(500);
    expect(res.body).toEqual(INTERNAL_ERROR_BODY);
  });

  it("STRIPE_PRICE_ID が未設定なら 500 を返し、Stripe を呼ばない", async () => {
    vi.stubEnv("STRIPE_PRICE_ID", "");

    const res = await postCheckout();

    expect(res.status).toBe(500);
    expect(createSession).not.toHaveBeenCalled();
  });
});

describe("POST /v1/billing/webhook", () => {
  const RECEIVED = { received: true };

  function checkoutCompleted(session: Record<string, unknown> = {}, id = "evt_test_1") {
    return {
      id,
      object: "event",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_test_1",
          object: "checkout.session",
          payment_status: "paid",
          client_reference_id: "7",
          payment_intent: "pi_test_1",
          customer: null,
          ...session,
        },
      },
    };
  }

  /** Stripe と同じ方法で署名を付けて送る（署名するボディと送るボディを変えると、改ざんを再現できる） */
  function postWebhook(event: unknown, options: { secret?: string; signedPayload?: string } = {}) {
    const payload = JSON.stringify(event);
    const signature = getStripe().webhooks.generateTestHeaderString({
      payload: options.signedPayload ?? payload,
      secret: options.secret ?? WEBHOOK_SECRET,
    });
    return request(createTestApp())
      .post("/v1/billing/webhook")
      .set("Content-Type", "application/json")
      .set("Stripe-Signature", signature)
      .send(payload);
  }

  describe("決済の完了（checkout.session.completed・paid）", () => {
    it("処理済みとして記録し、契約を契約中・期限1年後・支払いIDつきに更新する", async () => {
      const res = await postWebhook(checkoutCompleted());

      expect(res.status).toBe(200);
      expect(res.body).toEqual(RECEIVED);
      expect(mocks.createEvent).toHaveBeenCalledWith({
        data: { eventId: "evt_test_1", type: "checkout.session.completed" },
      });
      expect(mocks.updateContract).toHaveBeenCalledWith({
        where: { schoolId: 7 },
        data: {
          status: "active",
          activatedAt: NOW,
          activeEndsAt: new Date("2027-10-10T03:00:00.000Z"),
          stripePaymentIntentId: "pi_test_1",
        },
      });
    });

    it("顧客IDが届いたときは、あわせて保存する", async () => {
      await postWebhook(checkoutCompleted({ customer: "cus_test_1" }));

      expect(mocks.updateContract.mock.calls[0][0].data.stripeCustomerId).toBe("cus_test_1");
    });

    it("有効期限は、カレンダーで1年後にする（2/29 は翌年の 3/1）", async () => {
      vi.setSystemTime(new Date("2028-02-29T00:00:00.000Z"));

      await postWebhook(checkoutCompleted());

      expect(mocks.updateContract.mock.calls[0][0].data.activeEndsAt).toEqual(
        new Date("2029-03-01T00:00:00.000Z"),
      );
    });

    it("同じイベントが2回届いたら、2回目は契約を更新せずに 200 を返す（冪等）", async () => {
      mocks.createEvent.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Unique constraint failed", {
          code: "P2002",
          clientVersion: "test",
        }),
      );

      const res = await postWebhook(checkoutCompleted());

      expect(res.status).toBe(200);
      expect(res.body).toEqual(RECEIVED);
      expect(mocks.updateContract).not.toHaveBeenCalled();
    });
  });

  describe("署名の検証", () => {
    it("別の鍵で署名されたものは 400 を返し、DB にさわらない", async () => {
      const res = await postWebhook(checkoutCompleted(), { secret: "whsec_other_secret" });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(mocks.createEvent).not.toHaveBeenCalled();
      expect(mocks.updateContract).not.toHaveBeenCalled();
    });

    it("署名のあとでボディが書きかえられたものは 400 を返す", async () => {
      const original = JSON.stringify(checkoutCompleted({ client_reference_id: "7" }));

      const res = await postWebhook(checkoutCompleted({ client_reference_id: "99" }), {
        signedPayload: original,
      });

      expect(res.status).toBe(400);
      expect(mocks.updateContract).not.toHaveBeenCalled();
    });

    it("Stripe-Signature ヘッダーが無ければ 400 を返す", async () => {
      const res = await request(createTestApp())
        .post("/v1/billing/webhook")
        .set("Content-Type", "application/json")
        .send(JSON.stringify(checkoutCompleted()));

      expect(res.status).toBe(400);
      expect(mocks.updateContract).not.toHaveBeenCalled();
    });

    it("STRIPE_WEBHOOK_SECRET が未設定なら 500 を返す（設定を直せば、Stripe の再送で処理できる）", async () => {
      vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");

      const res = await postWebhook(checkoutCompleted());

      expect(res.status).toBe(500);
      expect(mocks.updateContract).not.toHaveBeenCalled();
    });
  });

  describe("契約を更新しないもの（200 を返して、Stripe に再送させない）", () => {
    it.each([
      ["対象外のイベント", { ...checkoutCompleted(), type: "payment_intent.succeeded" }],
      ["未払いの Checkout", checkoutCompleted({ payment_status: "unpaid" })],
      ["学校IDが無い", checkoutCompleted({ client_reference_id: null })],
      ["学校IDが数値でない", checkoutCompleted({ client_reference_id: "abc" })],
    ])("%sは 200 を返し、DB にさわらない", async (_name, event) => {
      const res = await postWebhook(event);

      expect(res.status).toBe(200);
      expect(res.body).toEqual(RECEIVED);
      expect(mocks.createEvent).not.toHaveBeenCalled();
      expect(mocks.updateContract).not.toHaveBeenCalled();
    });

    it("学校に契約の行が無い場合は 200 を返す", async () => {
      mocks.updateContract.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError("Record to update not found", {
          code: "P2025",
          clientVersion: "test",
        }),
      );

      const res = await postWebhook(checkoutCompleted());

      expect(res.status).toBe(200);
      expect(res.body).toEqual(RECEIVED);
    });
  });

  it("DB の障害などで更新できなかったときは 500 を返す（Stripe が再送する）", async () => {
    mocks.updateContract.mockRejectedValue(new Error("db down"));

    const res = await postWebhook(checkoutCompleted());

    expect(res.status).toBe(500);
    expect(res.body).toEqual(INTERNAL_ERROR_BODY);
  });
});
