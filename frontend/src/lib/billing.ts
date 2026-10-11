import { adminFetch } from "@/lib/admin-auth";

// POST /v1/billing/checkout-session の結果（API設計 §3.7）
export type StartCheckoutResult =
  | { kind: "ok"; url: string }
  | { kind: "already_subscribed" }
  | { kind: "unauthorized" | "forbidden" }
  | { kind: "error" };

/** Stripe Checkout（Stripe 側の決済画面）の URL を取得する。学校は、サーバーが認証から決める */
export async function startCheckout(): Promise<StartCheckoutResult> {
  try {
    const response = await adminFetch("/v1/billing/checkout-session", { method: "POST" });
    if (response.status === 401) return { kind: "unauthorized" };
    if (response.status === 403) return { kind: "forbidden" };
    if (response.status === 409) return { kind: "already_subscribed" };
    if (!response.ok) return { kind: "error" };

    const body = (await response.json()) as { url?: unknown };
    return typeof body.url === "string" ? { kind: "ok", url: body.url } : { kind: "error" };
  } catch (error) {
    console.error(error);
    return { kind: "error" };
  }
}
