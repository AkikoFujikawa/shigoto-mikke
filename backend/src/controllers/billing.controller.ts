import { Prisma } from "@prisma/client";
import type { NextFunction, Request, Response } from "express";
import type Stripe from "stripe";
import { logger } from "../config/logger.js";
import { resolveContractStatus } from "../lib/contractStatus.js";
import { prisma } from "../lib/prisma.js";
import { createCheckoutUrl, isSignatureError, verifyWebhookEvent } from "../lib/stripe.js";

// API設計 §3.7 POST /v1/billing/checkout-session。学校は、認証した管理者の schoolId で決める
export async function createCheckoutSession(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const admin = req.admin;
    if (!admin) {
      next(new Error("requireAdmin を通っていません"));
      return;
    }

    const contract = await prisma.contract.findUnique({
      where: { schoolId: admin.schoolId },
      select: { status: true, trialEndsAt: true, activeEndsAt: true },
    });
    // 学校と契約は seed で必ずセットで作られる。無いのはデータの不整合（GET /v1/schools/me と同じ扱い）
    if (!contract) {
      next(new Error(`契約の行がありません（schoolId: ${admin.schoolId}）`));
      return;
    }

    // 契約中（期限内）は申し込めない。契約期限切れ・無料体験中・無料体験終了は、そのまま進める
    if (resolveContractStatus(contract, new Date()).status === "active") {
      res.status(409).json({
        error: { code: "ALREADY_SUBSCRIBED", message: "すでに契約中です" },
      });
      return;
    }

    res.status(200).json({ url: await createCheckoutUrl(admin.schoolId) });
  } catch (err) {
    next(err);
  }
}

/** 契約の有効期限＝契約開始からカレンダーで1年後（DB設計 contracts.active_ends_at） */
function oneYearAfter(date: Date): Date {
  const result = new Date(date);
  result.setUTCFullYear(result.getUTCFullYear() + 1);
  return result;
}

/** Stripe のオブジェクトは、ID の文字列か、展開されたオブジェクトで届く。ID だけを取り出す */
function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

function isUniqueViolation(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

function isRecordNotFound(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025";
}

const RECEIVED = { received: true };

/**
 * API設計 §3.7 POST /v1/billing/webhook。呼ぶのは Stripe で、認証は署名の検証だけ。
 * 200 以外を返すと Stripe が何日も送り直すため、直しようのないもの（対象外のイベント・未払い・
 * 学校が見つからない）は、ログに残して 200 を返す。DB の障害などは 500 にして、送り直してもらう。
 * このルートは express.json()・pinoHttp より前にあるので、ログは req.log ではなく logger で出す。
 */
export async function handleWebhook(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const signature = req.headers["stripe-signature"];
  if (!Buffer.isBuffer(req.body) || typeof signature !== "string") {
    res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "入力内容を確認してください" },
    });
    return;
  }

  let event: Stripe.Event;
  try {
    event = verifyWebhookEvent(req.body, signature);
  } catch (err) {
    if (isSignatureError(err)) {
      logger.warn("Stripe Webhook の署名の検証に失敗しました");
      res.status(400).json({
        error: { code: "VALIDATION_ERROR", message: "入力内容を確認してください" },
      });
      return;
    }
    logger.error({ err }, "Stripe Webhook を検証できませんでした");
    next(err);
    return;
  }

  if (event.type !== "checkout.session.completed") {
    res.status(200).json(RECEIVED);
    return;
  }

  const session = event.data.object;
  const schoolId = Number(session.client_reference_id);
  if (session.payment_status !== "paid") {
    logger.info({ eventId: event.id }, "未払いの Checkout のため、契約は更新しません");
    res.status(200).json(RECEIVED);
    return;
  }
  if (!Number.isInteger(schoolId) || schoolId <= 0) {
    logger.error({ eventId: event.id }, "Stripe Webhook から学校を特定できませんでした");
    res.status(200).json(RECEIVED);
    return;
  }

  const activatedAt = new Date();
  const stripeCustomerId = idOf(session.customer);
  try {
    // 処理済みの記録と契約の更新を、1つのトランザクションにする。
    // 同じイベントが2回届いたら、event_id の重複で記録に失敗し、契約は更新されない（冪等）
    await prisma.$transaction(async (tx) => {
      await tx.stripeEvent.create({ data: { eventId: event.id, type: event.type } });
      await tx.contract.update({
        where: { schoolId },
        data: {
          status: "active",
          activatedAt,
          activeEndsAt: oneYearAfter(activatedAt),
          stripePaymentIntentId: idOf(session.payment_intent),
          // 顧客は Checkout の設定によって作られないことがある。届いたときだけ保存する
          ...(stripeCustomerId ? { stripeCustomerId } : {}),
        },
      });
    });
  } catch (err) {
    if (isUniqueViolation(err)) {
      res.status(200).json(RECEIVED);
      return;
    }
    if (isRecordNotFound(err)) {
      logger.error({ eventId: event.id, schoolId }, "Stripe Webhook の学校に契約の行がありません");
      res.status(200).json(RECEIVED);
      return;
    }
    logger.error({ err, eventId: event.id }, "Stripe Webhook の処理に失敗しました");
    next(err);
    return;
  }

  logger.info({ eventId: event.id, schoolId }, "決済の完了を受け取り、契約を契約中にしました");
  res.status(200).json(RECEIVED);
}
