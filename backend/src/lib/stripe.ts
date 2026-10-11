import Stripe from "stripe";
import { env } from "../config/env.js";

// Stripe 連携（有料プランの申込み。API設計.md §3.7、#24、#68）。
// 一括払い・1年間有効で、Stripe 側の画面（Checkout）に遷移するだけ。カード情報はこのアプリでは扱わない

/** Stripe への呼び出しのタイムアウト（SDK の既定は 80 秒で、画面が長く止まるため短くする） */
export const STRIPE_TIMEOUT_MS = 10_000;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} が設定されていません`);
  return value;
}

let cachedStripe: Stripe | null = null;

// モジュール読み込み時には作らない。Stripe が未設定の環境でもサーバーを起動できるようにし、
// 設定漏れは、使う時点で原因が分かるエラーにする（requireAdmin の Firebase と同じ方針）
export function getStripe(): Stripe {
  if (!cachedStripe) {
    cachedStripe = new Stripe(requireEnv("STRIPE_SECRET_KEY"), { timeout: STRIPE_TIMEOUT_MS });
  }
  return cachedStripe;
}

/** Checkout の画面を作り、その URL を返す。学校は client_reference_id で渡し、Webhook で特定する */
export async function createCheckoutUrl(schoolId: number): Promise<string> {
  const frontendUrl = env.frontendUrl.replace(/\/$/, "");
  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    line_items: [{ price: requireEnv("STRIPE_PRICE_ID"), quantity: 1 }],
    client_reference_id: String(schoolId),
    success_url: `${frontendUrl}/admin?checkout=success`,
    cancel_url: `${frontendUrl}/admin?checkout=cancel`,
  });
  if (!session.url) throw new Error("Stripe から Checkout の URL が返りませんでした");
  return session.url;
}

/**
 * Webhook の署名（Stripe-Signature）を検証し、イベントを返す。
 * 検証には、JSON に直す前の生のボディが要る（1文字でも変わると署名が合わない）。
 * 署名が合わないときは StripeSignatureVerificationError を投げる（isSignatureError で見分ける）。
 */
export function verifyWebhookEvent(rawBody: Buffer, signature: string): Stripe.Event {
  return getStripe().webhooks.constructEvent(
    rawBody,
    signature,
    requireEnv("STRIPE_WEBHOOK_SECRET"),
  );
}

export function isSignatureError(err: unknown): boolean {
  return err instanceof Stripe.errors.StripeSignatureVerificationError;
}
