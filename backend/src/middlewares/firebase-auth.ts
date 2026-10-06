import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { Request, Response, NextFunction } from "express";
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

export const authenticateAdmin = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    initFirebaseAdmin();

    // Step 1️⃣: Authorization ヘッダーを取得
    const authHeader = req.headers.authorization;

    // Step 2️⃣: "Bearer <token>" 形式か確認
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      logger.warn("認証ヘッダーがありません");
      res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "トークンがありません",
        },
      });
      return;
    }

    // Step 3️⃣: "Bearer " を削除してトークン部分だけ抽出
    const idToken = authHeader.substring(7);

    // Step 4️⃣: Firebase でトークンを検証
    let decodedToken;
    try {
      decodedToken = await getAuth().verifyIdToken(idToken);
    } catch (error) {
      logger.warn({ err: error }, "Firebase トークン検証エラー");
      res.status(401).json({
        error: {
          code: "UNAUTHORIZED",
          message: "トークンが無効です",
        },
      });
      return;
    }

    // Step 5️⃣: Firebase UID を取得
    const firebaseUid = decodedToken.uid;

    // Step 6️⃣: DB から管理者を検索
    const schoolAdmin = await prisma.schoolAdmin.findUnique({
      where: { firebaseUid },
      include: { school: true },
    });

    if (!schoolAdmin) {
      logger.warn(`Firebase UID が DB に見つかりません: ${firebaseUid}`);
      res.status(403).json({
        error: {
          code: "FORBIDDEN",
          message: "権限がありません",
        },
      });
      return;
    }

    // Step 7️⃣: req.user にセット
    req.user = {
      role: "school_admin" as const,
      id: schoolAdmin.id,
      schoolId: schoolAdmin.schoolId,
    };

    logger.info(`管理者認証成功: id=${schoolAdmin.id}, schoolId=${schoolAdmin.schoolId}`);

    // 次のミドルウェア・ルートハンドラへ
    next();
  } catch (error) {
    logger.error({ err: error }, "認証ミドルウェアエラー");
    res.status(500).json({
      error: {
        code: "INTERNAL_ERROR",
        message: "サーバーエラーが発生しました",
      },
    });
  }
};
