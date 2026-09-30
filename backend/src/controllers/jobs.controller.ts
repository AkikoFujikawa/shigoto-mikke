import type { NextFunction, Request, Response } from "express";
import { matchedData } from "express-validator";
import { prisma } from "../lib/prisma.js";
import { getCached, setCached } from "../lib/cache.js";
import { buildWhyConnected } from "../lib/whyConnected.js";

const CACHE_TTL_SECONDS = 60 * 60;

/** 職業ごとのキャッシュキー。好きなもの・質問マスタ（master:interests など）に合わせる */
function jobCacheKey(jobId: number): string {
  return `master:job:${jobId}`;
}

/**
 * 生徒によって変わらない部分（API設計 §5「職業詳細（固定部分）」。Redis 1時間）。
 * interestIds・traitIds は whyConnected の計算用で、レスポンスには含めない。
 */
type JobDetailBase = {
  id: number;
  name: string;
  group: string;
  interestTags: string[];
  imageUrl: string | null;
  description: string;
  academics: { name: string; category: string }[];
  interestIds: number[];
  traitIds: number[];
};

/** 公開中の職業だけを読む（DB設計 jobs.is_published：false は表示の対象外） */
async function loadJobBase(jobId: number): Promise<JobDetailBase | null> {
  const job = await prisma.job.findFirst({
    where: { id: jobId, isPublished: true },
    select: {
      id: true,
      name: true,
      imageUrl: true,
      description: true,
      group: { select: { name: true } },
      interests: { select: { interest: { select: { id: true, label: true, sortOrder: true } } } },
      traits: { select: { traitId: true } },
      academics: {
        select: { academicField: { select: { name: true, category: true, sortOrder: true } } },
      },
    },
  });
  if (!job) return null;

  const interests = job.interests
    .map((i) => i.interest)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
  const academics = job.academics
    .map((a) => a.academicField)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return {
    id: job.id,
    name: job.name,
    group: job.group.name,
    interestTags: interests.map((i) => i.label),
    imageUrl: job.imageUrl,
    description: job.description,
    academics: academics.map((a) => ({ name: a.name, category: a.category })),
    interestIds: interests.map((i) => i.id),
    traitIds: job.traits.map((t) => t.traitId),
  };
}

/**
 * 「なぜあなたにつながる？」（API設計 §3.6）。生徒ごとに変わるのでキャッシュしない。
 * 最新の診断の候補なら保存済みの文、候補外ならその場で計算する（保存しない）。
 * 診断がまだない場合は、どのタグとも一致しないので「この仕事も、…」の文になる。
 */
async function findWhyConnected(studentId: number, job: JobDetailBase): Promise<string> {
  const diagnosis = await prisma.diagnosis.findFirst({
    where: { studentId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      jobs: { where: { jobId: job.id }, select: { whyText: true } },
      interests: { select: { interest: { select: { id: true, label: true, sortOrder: true } } } },
      strengths: { select: { trait: { select: { id: true, label: true, sortOrder: true } } } },
    },
  });

  const saved = diagnosis?.jobs[0];
  if (saved) return saved.whyText;

  return buildWhyConnected({
    selectedInterests: diagnosis?.interests.map((i) => i.interest) ?? [],
    strengthTraits: diagnosis?.strengths.map((s) => s.trait) ?? [],
    jobInterestIds: job.interestIds,
    jobTraitIds: job.traitIds,
  });
}

// API設計 §3.6 GET /v1/jobs/{jobId}
export async function getJob(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const student = req.student;
    if (!student) {
      next(new Error("requireStudent を通っていません"));
      return;
    }
    const { jobId } = matchedData(req) as { jobId: number };

    const key = jobCacheKey(jobId);
    let job = await getCached<JobDetailBase>(key);
    if (!job) {
      job = await loadJobBase(jobId);
      if (!job) {
        res.status(404).json({
          error: { code: "JOB_NOT_FOUND", message: "職業が見つかりません" },
        });
        return;
      }
      await setCached(key, job, CACHE_TTL_SECONDS);
    }

    const whyConnected = await findWhyConnected(student.id, job);

    res.status(200).json({
      id: job.id,
      name: job.name,
      group: job.group,
      interestTags: job.interestTags,
      imageUrl: job.imageUrl,
      whyConnected,
      description: job.description,
      academics: job.academics,
    });
  } catch (err) {
    next(err);
  }
}
