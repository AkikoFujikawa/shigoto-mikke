import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";

// API設計 §3.3 GET /v1/me。認証済みのロールに応じて、生徒（nickname つき）か管理者の情報を返す
export async function getMe(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (req.admin) {
      const { role, id, schoolId } = req.admin;
      res.status(200).json({ role, id, schoolId });
      return;
    }

    if (req.student) {
      const { id, schoolId } = req.student;
      const student = await prisma.student.findUnique({
        where: { id },
        select: { nickname: true },
      });
      if (student) {
        res.status(200).json({ role: "student", id, schoolId, nickname: student.nickname });
        return;
      }
    }

    // 認証後に生徒が削除された場合など。requireStudent と同じ 401 にそろえる
    res.status(401).json({
      error: { code: "UNAUTHORIZED", message: "もう一度はじめからお試しください" },
    });
  } catch (err) {
    next(err);
  }
}
