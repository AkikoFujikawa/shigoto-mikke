import { createHash } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { matchedData } from "express-validator";
import { rankJobCandidates, selectStrengths } from "../lib/matching.js";
import { prisma } from "../lib/prisma.js";
import { describeStrengths } from "../lib/strengthCache.js";
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

// API設計 §3.5。強みの説明は AI で生成し、失敗・タイムアウト・不正な出力なら traits.description の固定文にする（#65・案A）
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

    // ---- 強みの説明を AI で作る（#65）。失敗・タイムアウト・不正な出力なら固定文にする（案A） ----
    // 同じ強み3つの文が保存済みなら、AI を呼ばずにそれを使う（#70）
    const ai = await describeStrengths(
      strengthTraits.map(({ code, label, description }) => ({ code, label, description })),
    );
    const descriptionOf = (trait: { code: string; description: string }) =>
      ai?.descriptions.get(trait.code) ?? trait.description;
    if (ai?.fromCache) {
      req.log?.info({ aiModel: ai.model }, "保存済みの AI の強みの説明を使いました");
    } else if (ai) {
      req.log?.info({ aiModel: ai.model }, "AI で強みの説明を生成しました");
    } else {
      req.log?.warn("AI が使えなかったため、強みの説明を固定文にフォールバックしました");
    }

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
        aiModel: ai?.model ?? null,
        usedFallback: ai === null,
        interests: { create: interestIds.map((interestId) => ({ interestId })) },
        answers: {
          create: answers.map((a) => ({ questionId: a.questionId, optionId: a.optionId })),
        },
        strengths: {
          create: strengthTraits.map((trait, index) => ({
            rank: index + 1,
            traitId: trait.id,
            description: descriptionOf(trait),
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
        description: descriptionOf(trait),
      })),
      jobCount: candidates.length,
    });
  } catch (err) {
    next(err);
  }
}

const DIAGNOSIS_NOT_FOUND = {
  error: { code: "DIAGNOSIS_NOT_FOUND", message: "診断結果が見つかりません" },
};

// 最新の診断＝その生徒の created_at が最新の1件（同時刻なら id の大きい方）。他の生徒の診断は見ない
const latestOrder = [{ createdAt: "desc" as const }, { id: "desc" as const }];

// API設計 §3.5 GET /v1/diagnoses/latest。POST の 201 と同じ形で返す
export async function getLatestDiagnosis(
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

    const diagnosis = await prisma.diagnosis.findFirst({
      where: { studentId: student.id },
      orderBy: latestOrder,
      select: {
        id: true,
        createdAt: true,
        strengths: {
          orderBy: { rank: "asc" },
          select: { description: true, trait: { select: { code: true, label: true } } },
        },
        _count: { select: { jobs: true } },
      },
    });
    if (!diagnosis) {
      res.status(404).json(DIAGNOSIS_NOT_FOUND);
      return;
    }

    res.json({
      id: diagnosis.id,
      createdAt: diagnosis.createdAt,
      strengths: diagnosis.strengths.map((strength) => ({
        code: strength.trait.code,
        title: strength.trait.label,
        description: strength.description,
      })),
      jobCount: diagnosis._count.jobs,
    });
  } catch (err) {
    next(err);
  }
}

// API設計 §3.5 GET /v1/diagnoses/latest/jobs。おすすめ順（rank）で返し、スコアは返さない
export async function getLatestDiagnosisJobs(
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

    const diagnosis = await prisma.diagnosis.findFirst({
      where: { studentId: student.id },
      orderBy: latestOrder,
      select: {
        jobs: {
          orderBy: { rank: "asc" },
          select: {
            job: {
              select: {
                id: true,
                name: true,
                summary: true,
                imageUrl: true,
                emoji: true,
                interests: { select: { interest: { select: { label: true, sortOrder: true } } } },
              },
            },
          },
        },
      },
    });
    if (!diagnosis) {
      res.status(404).json(DIAGNOSIS_NOT_FOUND);
      return;
    }

    res.json({
      items: diagnosis.jobs.map(({ job }) => ({
        id: job.id,
        name: job.name,
        summary: job.summary,
        interestTags: job.interests
          .map(({ interest }) => interest)
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((interest) => interest.label),
        imageUrl: job.imageUrl,
        emoji: job.emoji,
      })),
    });
  } catch (err) {
    next(err);
  }
}
