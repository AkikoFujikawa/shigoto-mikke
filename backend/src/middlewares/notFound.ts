import type { Request, Response } from "express";

/**
 * どのルートにも当てはまらなかったとき（存在しない URL）の受け皿（#71）。
 * Express の既定は HTML の「Cannot GET …」を返すため、共通形式の JSON で返す（API設計 §4）。
 */
export function handleNotFound(_req: Request, res: Response): void {
  res.status(404).json({
    error: { code: "NOT_FOUND", message: "見つかりませんでした" },
  });
}
