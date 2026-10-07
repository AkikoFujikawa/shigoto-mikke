import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import { extractBearerToken } from "../lib/bearerToken.js";
import { requireStudent } from "./requireStudent.js";
import { requireAdmin, UNAUTHORIZED_BODY } from "./requireAdmin.js";

type TokenKind = "malformed" | "student" | "other";

/**
 * 署名は検証せず、中身の role だけで振り分け先を決める（検証は振り分け先が必ず行う）。
 * role を偽っても、振り分け先の検証で 401 になるため、認証を迂回することはできない。
 */
function classifyToken(token: string): TokenKind {
  const payload = jwt.decode(token);
  if (payload === null || typeof payload === "string") return "malformed";
  return payload.role === "student" ? "student" : "other";
}

/**
 * 生徒・管理者のどちらでも呼べるAPI（GET /v1/me）の認証。
 * 生徒のトークン（role が student の JWT）は、期限切れ・不正でも生徒として扱い、Firebase を使わない。
 * JWT でない文字列は、Firebase を使わずその場で 401 にする。
 * それ以外の JWT は Firebase の ID トークンとして管理者の認証に回す（Firebase の設定ミスはここで 500 になる）。
 */
export async function requireStudentOrAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = extractBearerToken(req.headers.authorization);
  const kind = token === null ? "malformed" : classifyToken(token);

  if (kind === "malformed") {
    res.status(401).json(UNAUTHORIZED_BODY);
  } else if (kind === "student") {
    await requireStudent(req, res, next);
  } else {
    await requireAdmin(req, res, next);
  }
}
