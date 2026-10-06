import type { NextFunction, Request, Response } from "express";
import { extractBearerToken } from "../lib/bearerToken.js";
import { verifyStudentToken } from "../lib/sessionToken.js";
import { requireAdmin } from "./requireAdmin.js";
import { requireStudent } from "./requireStudent.js";

/**
 * 生徒・管理者のどちらでも呼べるAPI（GET /v1/me）の認証。
 * 有効な生徒トークン（自前のJWT・ネットワーク不要）なら生徒として、それ以外は Firebase の
 * ID トークンとして管理者の認証に回す。生徒のリクエストでは Firebase を呼ばない。
 */
export async function requireStudentOrAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  let isStudentToken: boolean;
  try {
    const token = extractBearerToken(req.headers.authorization);
    isStudentToken = token !== null && verifyStudentToken(token) !== null;
  } catch (err) {
    next(err);
    return;
  }

  if (isStudentToken) {
    await requireStudent(req, res, next);
  } else {
    await requireAdmin(req, res, next);
  }
}
