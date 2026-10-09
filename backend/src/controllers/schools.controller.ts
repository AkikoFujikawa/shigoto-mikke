import type { NextFunction, Request, Response } from "express";
import { resolveContractStatus } from "../lib/contractStatus.js";
import { prisma } from "../lib/prisma.js";

// API設計 §3.7 GET /v1/schools/me。学校は、認証した管理者の schoolId で決める（パラメータでは受け取らない）。
// 支払いの直後に契約状態が変わるので、キャッシュはしない
export async function getMySchool(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const admin = req.admin;
    if (!admin) {
      next(new Error("requireAdmin を通っていません"));
      return;
    }

    // 返す項目だけを取る（Stripe の ID・管理者のメールなどの内部情報は読まない）
    const school = await prisma.school.findUnique({
      where: { id: admin.schoolId },
      select: {
        id: true,
        name: true,
        schoolCode: true,
        contract: { select: { status: true, trialEndsAt: true, activeEndsAt: true } },
      },
    });
    // 学校と契約は seed で必ずセットで作られる。無いのはデータの不整合なので、想定外のエラーにしてログに残す
    if (!school?.contract) {
      next(new Error(`学校または契約の行がありません（schoolId: ${admin.schoolId}）`));
      return;
    }

    res.status(200).json({
      school: { id: school.id, name: school.name, schoolCode: school.schoolCode },
      contract: resolveContractStatus(school.contract, new Date()),
    });
  } catch (err) {
    next(err);
  }
}
