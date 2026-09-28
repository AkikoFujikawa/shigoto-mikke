import { createHash } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { matchedData } from "express-validator";
import { rankJobCandidates, selectStrengths } from "../lib/matching.js";
import { prisma } from "../lib/prisma.js";
import { buildWhyConnected } from "../lib/whyConnected.js";

type Answer = { questionId: number; optionId: number };
type DiagnosisInput = { interestIds: number[]; answers: Answer[] };

function sendValidationError(res: Response, field: string, message: string): void {
  res.status(400).json({
    error: {
      code: "VALIDATION_ERROR",
      message: "入力内容を確認してください",
      details: [{ field, message }],
    },
  });
}

/** 入力の SHA-256。並び順が違っても同じ入力なら同じ値になるよう、並べ替えてから計算する（DB設計 diagnoses.input_hash） */
function makeInputHash({ interestIds, answers }: DiagnosisInput): string {
  const normalized = {
    interestIds: [...interestIds].sort((a, b) => a - b),
    answers: [...answers]
      .sort((a, b) => a.questionId - b.questionId)
      .map((a) => [a.questionId, a.optionId]),
  };
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

// API設計 §3.5。AIは未接続のため、強みの説明は traits.description の固定文（#59。AI接続は #65）
export async function createDiagnosis(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const student = req.student;
    if (!student) {
      next(new Error("requireStudent を通っていません"));
      return;
    }
    const { interestIds, answers } = matchedData(req) as DiagnosisInput;

    // ---- DBを見る検証 ----
    const [interests, options, traits] = await Promise.all([
      prisma.interest.findMany({
        where: { id: { in: interestIds } },
        select: { id: true, label: true, sortOrder: true },
      }),
      prisma.questionOption.findMany({
        where: { id: { in: answers.map((a) => a.optionId) } },
        select: { id: true, questionId: true, traitId: true },
      }),
      prisma.trait.findMany({
        select: { id: true, code: true, label: true, description: true, sortOrder: true },
      }),
    ]);

    if (interests.length !== interestIds.length) {
      sendValidationError(res, "interestIds", "選択内容を確認してください");
      return;
    }

    const optionById = new Map(options.map((o) => [o.id, o]));
    const answerTraitIds: number[] = [];
    for (const answer of answers) {
      const option = optionById.get(answer.optionId);
      if (!option || option.questionId !== answer.questionId) {
        sendValidationError(res, "answers", "回答を確認してください");
        return;
      }
      answerTraitIds.push(option.traitId);
    }

    // ---- 強みと職業候補の計算（#58） ----
    const strengthIds = selectStrengths({ answerTraitIds, traits });
    const traitById = new Map(traits.map((t) => [t.id, t]));
    const strengthTraits = strengthIds.flatMap((id) => {
      const trait = traitById.get(id);
      return trait ? [trait] : [];
    });

    const publishedJobs = await prisma.job.findMany({
      where: { isPublished: true },
      select: {
        id: true,
        interests: { select: { interestId: true } },
        traits: { select: { traitId: true } },
      },
    });
    const jobsForMatching = publishedJobs.map((job) => ({
      id: job.id,
      interestIds: job.interests.map((i) => i.interestId),
      traitIds: job.traits.map((t) => t.traitId),
    }));
    const jobById = new Map(jobsForMatching.map((job) => [job.id, job]));

    const candidates = rankJobCandidates({
      interestIds,
      strengthTraitIds: strengthIds,
      jobs: jobsForMatching,
    });

    // ---- 保存（ネスト作成なので1つのトランザクションになる） ----
    const diagnosis = await prisma.diagnosis.create({
      data: {
        studentId: student.id,
        inputHash: makeInputHash({ interestIds, answers }),
        aiModel: null,
        usedFallback: true,
        interests: { create: interestIds.map((interestId) => ({ interestId })) },
        answers: {
          create: answers.map((a) => ({ questionId: a.questionId, optionId: a.optionId })),
        },
        strengths: {
          create: strengthTraits.map((trait, index) => ({
            rank: index + 1,
            traitId: trait.id,
            description: trait.description,
          })),
        },
        jobs: {
          create: candidates.map((candidate) => {
            const job = jobById.get(candidate.jobId);
            return {
              rank: candidate.rank,
              jobId: candidate.jobId,
              score: candidate.score,
              whyText: buildWhyConnected({
                selectedInterests: interests,
                strengthTraits,
                jobInterestIds: job?.interestIds ?? [],
                jobTraitIds: job?.traitIds ?? [],
              }),
            };
          }),
        },
      },
      select: { id: true, createdAt: true },
    });

    res.status(201).json({
      id: diagnosis.id,
      createdAt: diagnosis.createdAt,
      strengths: strengthTraits.map((trait) => ({
        code: trait.code,
        title: trait.label,
        description: trait.description,
      })),
      jobCount: candidates.length,
    });
  } catch (err) {
    next(err);
  }
}
