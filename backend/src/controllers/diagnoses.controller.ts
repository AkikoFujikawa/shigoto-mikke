import type { NextFunction, Request, Response } from "express";

// 仮実装。次のステップで中身を書く
export async function createDiagnosis(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    res.status(501).json({ error: { code: "NOT_IMPLEMENTED", message: "未実装です" } });
  } catch (err) {
    next(err);
  }
}
