import type { NextFunction, Request, Response } from "express";
import { matchedData } from "express-validator";
import { prisma } from "../lib/prisma.js";
import { issueStudentToken, SESSION_EXPIRES_IN_SECONDS } from "../lib/sessionToken.js";

// 学校コードの利用可否は契約状態では制限しない（API設計 §3.1、FR-A05は実施しない）
export async function createStudentSession(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { schoolCode, nickname } = matchedData(req) as { schoolCode: string; nickname: string };

    const school = await prisma.school.findUnique({
      where: { schoolCode },
      select: { id: true, name: true },
    });
    if (!school) {
      res.status(404).json({
        error: {
          code: "SCHOOL_CODE_NOT_FOUND",
          message: "学校コードが見つかりません",
        },
      });
      return;
    }

    const student = await prisma.student.create({
      data: { schoolId: school.id, nickname },
      select: { id: true, nickname: true },
    });

    const token = issueStudentToken({ studentId: student.id, schoolId: school.id });

    res.status(201).json({
      token,
      expiresIn: SESSION_EXPIRES_IN_SECONDS,
      student,
      school: { name: school.name },
    });
  } catch (err) {
    next(err);
  }
}
