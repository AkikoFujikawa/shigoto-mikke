import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import type { NextFunction, Request, Response } from "express";
import { extractBearerToken } from "../lib/bearerToken.js";
import { prisma } from "../lib/prisma.js";
import { logger } from "../config/logger.js";

const REQUIRED_FIREBASE_ENV = [
  "FIREBASE_PROJECT_ID",
  "FIREBASE_PRIVATE_KEY",
  "FIREBASE_CLIENT_EMAIL",
] as const;

// モジュール読み込み時には初期化しない。Firebase 未設定の環境でもサーバーを起動できるようにし、
// 設定ミスは最初の認証リクエスト（または起動時に呼ぶ場合はその時点）で原因が分かる形で失敗させる。
export function initFirebaseAdmin(): void {
  if (getApps().length) return;

  const missing = REQUIRED_FIREBASE_ENV.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    throw new Error(`Firebase の環境変数が未設定です: ${missing.join(", ")}`);
  }

  try {
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      }),
    });
  } catch (error) {
    throw new Error(
      "Firebase の初期化に失敗しました。FIREBASE_PRIVATE_KEY の形式（改行を \\n で表した1行）などを確認してください",
      { cause: error },
    );
  }
}

const UNAUTHORIZED_BODY = {
  error: { code: "UNAUTHORIZED", message: "認証できませんでした。もう一度お試しください" },
};

/**
 * 学校管理者向けAPIの認証。Firebase の ID トークンを検証し、firebase_uid が一致する管理者を
 * school_admins から探して req.admin に渡す。
 * トークンが無い・不正・期限切れは 401、検証できても管理者として未登録なら 403（API設計 §4）。
 */
export async function requireAdmin(req: Request, res: Response, next: NextFunction): Promise<void> {
  const idToken = extractBearerToken(req.headers.authorization);
  if (!idToken) {
    res.status(401).json(UNAUTHORIZED_BODY);
    return;
  }

  try {
    initFirebaseAdmin();

    let firebaseUid: string;
    try {
      firebaseUid = (await getAuth().verifyIdToken(idToken)).uid;
    } catch (err) {
      logger.warn({ err }, "Firebase ID トークンの検証に失敗しました");
      res.status(401).json(UNAUTHORIZED_BODY);
      return;
    }

    const schoolAdmin = await prisma.schoolAdmin.findUnique({
      where: { firebaseUid },
      select: { id: true, schoolId: true },
    });
    if (!schoolAdmin) {
      logger.warn({ firebaseUid }, "Firebase UID が school_admins に登録されていません");
      res.status(403).json({
        error: { code: "FORBIDDEN", message: "権限がありません" },
      });
      return;
    }

    req.admin = { role: "school_admin", id: schoolAdmin.id, schoolId: schoolAdmin.schoolId };
    next();
  } catch (err) {
    next(err);
  }
}
