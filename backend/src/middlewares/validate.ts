import type { NextFunction, Request, Response } from "express";
import { validationResult } from "express-validator";

/**
 * express-validator の検証エラーを 400 に統一する共通ミドルウェア。
 * API設計 §4 のエラーフォーマットに合わせる。
 * ルート定義の直前（バリデーションルールの後）に置いて使う。
 */
export function handleValidationErrors(req: Request, res: Response, next: NextFunction): void {
  const result = validationResult(req);
  if (result.isEmpty()) {
    next();
    return;
  }
  res.status(400).json({
    error: {
      code: "VALIDATION_ERROR",
      message: "入力内容を確認してください",
      details: result.array().map((e) => ({
        field: "path" in e ? e.path : "unknown",
        message: e.msg,
      })),
    },
  });
}
