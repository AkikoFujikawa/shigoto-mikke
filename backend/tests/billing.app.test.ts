import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";
import { getStripe } from "../src/lib/stripe.js";

const WEBHOOK_SECRET = "whsec_test_secret";

// 本物の app.ts の並びで確かめる。Webhook が express.json() より後ろに登録されると、
// ボディが JSON に直されてしまい、正しい署名でも検証に失敗する（#68）
describe("決済のルートの登録（app.ts）", () => {
  beforeEach(() => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", WEBHOOK_SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("正しい署名の Webhook は、生のボディのまま検証されて 200 を返す", async () => {
    // 契約を更新しないイベントなので、DB は使わない
    const payload = JSON.stringify({
      id: "evt_test_app",
      object: "event",
      type: "payment_intent.succeeded",
      data: { object: { id: "pi_test_app", object: "payment_intent" } },
    });
    const signature = getStripe().webhooks.generateTestHeaderString({
      payload,
      secret: WEBHOOK_SECRET,
    });

    const res = await request(createApp())
      .post("/v1/billing/webhook")
      .set("Content-Type", "application/json")
      .set("Stripe-Signature", signature)
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ received: true });
  });

  it("署名が正しくない Webhook は 400 を返す", async () => {
    const res = await request(createApp())
      .post("/v1/billing/webhook")
      .set("Content-Type", "application/json")
      .set("Stripe-Signature", "t=1,v1=invalid")
      .send(JSON.stringify({ id: "evt_test_app" }));

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("checkout-session は、トークンが無ければ 401 を返す（404 ではない＝登録されている）", async () => {
    const res = await request(createApp()).post("/v1/billing/checkout-session");

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHORIZED");
  });
});
