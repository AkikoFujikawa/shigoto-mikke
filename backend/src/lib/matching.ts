// 重み・件数は API設計.md §3.5。式は確定待ちのため、変更は定数の値だけで済むようにする（#58）
export const INTEREST_WEIGHT = 3;
export const TRAIT_WEIGHT = 2;
export const STRENGTH_COUNT = 3;
export const JOB_CANDIDATE_COUNT = 10;

export type TraitForMatching = {
  id: number;
  sortOrder: number;
};

export type JobForMatching = {
  id: number;
  interestIds: number[];
  traitIds: number[];
};

export type JobCandidate = {
  jobId: number;
  score: number;
  rank: number;
};

/**
 * 回答（5問ぶんの特性ID）から、強み3つの特性IDを決める。
 * 多い順に選び、同数は sortOrder の小さい順。
 * 返す順は sortOrder 順（得点順にすると順位に見えるため。API設計.md §3.5）。
 */
export function selectStrengths({
  answerTraitIds,
  traits,
}: {
  answerTraitIds: number[];
  traits: TraitForMatching[];
}): number[] {
  const counts = new Map<number, number>();
  for (const traitId of answerTraitIds) {
    counts.set(traitId, (counts.get(traitId) ?? 0) + 1);
  }
  const countOf = (trait: TraitForMatching) => counts.get(trait.id) ?? 0;

  return [...traits]
    .sort((a, b) => countOf(b) - countOf(a) || a.sortOrder - b.sortOrder || a.id - b.id)
    .slice(0, STRENGTH_COUNT)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id)
    .map((trait) => trait.id);
}

function countMatches(ids: number[], targets: Set<number>): number {
  return new Set(ids.filter((id) => targets.has(id))).size;
}

/**
 * 職業ごとに「好きなもの一致数 × INTEREST_WEIGHT ＋ 強み一致数 × TRAIT_WEIGHT」を計算し、
 * スコアの高い順に上位 JOB_CANDIDATE_COUNT 件を返す。同点は職業IDの小さい順。
 */
export function rankJobCandidates({
  interestIds,
  strengthTraitIds,
  jobs,
}: {
  interestIds: number[];
  strengthTraitIds: number[];
  jobs: JobForMatching[];
}): JobCandidate[] {
  const selectedInterests = new Set(interestIds);
  const strengths = new Set(strengthTraitIds);

  return jobs
    .map((job) => ({
      jobId: job.id,
      score:
        countMatches(job.interestIds, selectedInterests) * INTEREST_WEIGHT +
        countMatches(job.traitIds, strengths) * TRAIT_WEIGHT,
    }))
    .sort((a, b) => b.score - a.score || a.jobId - b.jobId)
    .slice(0, JOB_CANDIDATE_COUNT)
    .map((candidate, index) => ({ ...candidate, rank: index + 1 }));
}
