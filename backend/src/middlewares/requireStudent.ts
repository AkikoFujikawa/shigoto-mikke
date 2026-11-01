import type { NextFunction, Request, Response } from "express";
import { extractBearerToken } from "../lib/bearerToken.js";
import { prisma } from "../lib/prisma.js";
import { verifyStudentToken } from "../lib/sessionToken.js";

async function findAuthenticatedStudent(
  header: string | undefined,
): Promise<{ id: number; schoolId: number } | null> {
  const token = extractBearerToken(header);
  if (!token) return null;

  const payload = verifyStudentToken(token);
  if (!payload) return null;

  const student = await prisma.student.findUnique({
    where: { id: payload.studentId },
    select: { id: true, schoolId: true },
  });
  if (!student || student.schoolId !== payload.schoolId) return null;

  return student;
}

/**
 * 生徒向けAPIの共通認証。トークンが無い・不正・期限切れ、または生徒がDBに存在しない・
 * 学校が一致しない場合は、理由を区別せず 401 を返す（API設計 §4）。
 */
export async function requireStudent(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  let student: { id: number; schoolId: number } | null;
  try {
    student = await findAuthenticatedStudent(req.headers.authorization);
  } catch (err) {
    next(err);
    return;
  }

  if (!student) {
    res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "もう一度はじめからお試しください",
      },
    });
    return;
  }

  req.student = student;
  next();
}
