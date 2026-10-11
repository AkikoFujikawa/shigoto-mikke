import express, { Router } from "express";
import { createCheckoutSession, handleWebhook } from "../controllers/billing.controller.js";
import { requireAdmin } from "../middlewares/requireAdmin.js";

// API設計 §3.7: POST /v1/billing/checkout-session は管理者だけが呼べる（ボディなし。学校は認証から決める）
export const billingRouter = Router();
billingRouter.post("/billing/checkout-session", requireAdmin, createCheckoutSession);

// POST /v1/billing/webhook は Stripe が呼ぶ。署名の検証には JSON に直す前の生のボディが要るので、
// このルートだけ express.raw() で受け取り、app.ts で express.json() より前に登録する
export const billingWebhookRouter = Router();
billingWebhookRouter.post(
  "/billing/webhook",
  express.raw({ type: "application/json" }),
  handleWebhook,
);
