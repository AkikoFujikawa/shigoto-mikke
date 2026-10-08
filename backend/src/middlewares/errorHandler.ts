import type { NextFunction, Request, Response } from "express";

/** express.json() が JSON を読めなかったときのエラーか（body-parser が type を付ける） */
function isJsonParseError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { type?: unknown }).type === "entity.parse.failed"
  );
}

/**
 * 想定外エラーの最終ハンドラ。スタックトレース等の内部情報はログにのみ出す。
 * ただし、壊れた JSON は送った側の入力の問題なので、400 VALIDATION_ERROR にする（#71）。
 */
export function handleUnexpectedError(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (isJsonParseError(err)) {
    res.status(400).json({
      error: { code: "VALIDATION_ERROR", message: "入力内容を確認してください" },
    });
    return;
  }

  req.log?.error({ err }, "unexpected error");
  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: "サーバーエラーが発生しました",
    },
  });
}
