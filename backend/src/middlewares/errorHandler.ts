import type { NextFunction, Request, Response } from "express";

/**
 * 想定外エラーの最終ハンドラ。スタックトレース等の内部情報はログにのみ出す。
 */
export function handleUnexpectedError(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  req.log?.error({ err }, "unexpected error");
  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "サーバーエラーが発生しました",
    },
  });
}
