import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  JOB_CANDIDATE_COUNT,
  rankJobCandidates,
  selectStrengths,
  type JobForMatching,
  type TraitForMatching,
} from "../src/lib/matching.js";

// seed.ts の TRAITS と同じ並び（sortOrder）
const EXPLORE = 1;
const IDEATE = 2;
const EXPRESS = 3;
const SUPPORT = 4;
const CRAFT = 5;
const TRAITS: TraitForMatching[] = [
  { id: EXPLORE, sortOrder: 1 },
  { id: IDEATE, sortOrder: 2 },
  { id: EXPRESS, sortOrder: 3 },
  { id: SUPPORT, sortOrder: 4 },
  { id: CRAFT, sortOrder: 5 },
];

describe("selectStrengths", () => {
  it("回答の多い順に3つ選び、同数は sortOrder の小さい順で決める", () => {
    const strengths = selectStrengths({
      answerTraitIds: [EXPLORE, EXPLORE, IDEATE, EXPRESS, SUPPORT],
      traits: TRAITS,
    });

    expect(strengths).toEqual([EXPLORE, IDEATE, EXPRESS]);
  });

  it("得点順ではなく sortOrder 順で返す", () => {
    const strengths = selectStrengths({
      answerTraitIds: [CRAFT, CRAFT, SUPPORT, SUPPORT, EXPLORE],
      traits: TRAITS,
    });

    expect(strengths).toEqual([EXPLORE, SUPPORT, CRAFT]);
  });

  it("5つとも別の特性なら、sortOrder の小さい3つになる", () => {
    const strengths = selectStrengths({
      answerTraitIds: [CRAFT, SUPPORT, EXPRESS, IDEATE, EXPLORE],
      traits: TRAITS,
    });

    expect(strengths).toEqual([EXPLORE, IDEATE, EXPRESS]);
  });

  it("回答や特性マスタの並び順が変わっても、同じ結果になる", () => {
    const a = selectStrengths({
      answerTraitIds: [IDEATE, CRAFT, IDEATE, SUPPORT, CRAFT],
      traits: TRAITS,
    });
    const b = selectStrengths({
      answerTraitIds: [CRAFT, SUPPORT, CRAFT, IDEATE, IDEATE],
      traits: [...TRAITS].reverse(),
    });

    expect(a).toEqual([IDEATE, SUPPORT, CRAFT]);
    expect(b).toEqual(a);
  });

  it("5問の選択肢の全組み合わせ(32通り)で、強みは必ず回答に出た特性3つになる", () => {
    // DB設計.md §6.3 の選択肢と特性の対応（各問の2択）
    const QUESTIONS = [
      [EXPLORE, IDEATE],
      [EXPRESS, SUPPORT],
      [IDEATE, CRAFT],
      [EXPRESS, SUPPORT],
      [EXPLORE, CRAFT],
    ];

    for (let pattern = 0; pattern < 2 ** QUESTIONS.length; pattern++) {
      const answerTraitIds = QUESTIONS.map((options, i) => options[(pattern >> i) & 1]);
      const strengths = selectStrengths({ answerTraitIds, traits: TRAITS });

      expect(strengths).toHaveLength(3);
      for (const traitId of strengths) {
        expect(answerTraitIds).toContain(traitId);
      }
    }
  });
});

describe("rankJobCandidates", () => {
  it("好きなもの一致数×3＋強み一致数×2 でスコアを計算する", () => {
    const candidates = rankJobCandidates({
      interestIds: [1, 2],
      strengthTraitIds: [EXPLORE, IDEATE, EXPRESS],
      jobs: [{ id: 7, interestIds: [1, 2, 3], traitIds: [EXPLORE, CRAFT] }],
    });

    expect(candidates).toEqual([{ jobId: 7, score: 2 * 3 + 1 * 2, rank: 1 }]);
  });

  it("スコアの高い順に並べ、同点は職業IDの小さい順にする", () => {
    const candidates = rankJobCandidates({
      interestIds: [1],
      strengthTraitIds: [EXPLORE, IDEATE, EXPRESS],
      jobs: [
        { id: 30, interestIds: [2], traitIds: [EXPLORE] },
        { id: 20, interestIds: [1], traitIds: [] },
        { id: 10, interestIds: [2], traitIds: [EXPLORE] },
        { id: 40, interestIds: [1], traitIds: [IDEATE] },
      ],
    });

    expect(candidates).toEqual([
      { jobId: 40, score: 5, rank: 1 },
      { jobId: 20, score: 3, rank: 2 },
      { jobId: 10, score: 2, rank: 3 },
      { jobId: 30, score: 2, rank: 4 },
    ]);
  });

  it("上位10件だけを返す。好きなものの一致が少なくても、強みの一致で10件を埋める", () => {
    const jobs: JobForMatching[] = Array.from({ length: 15 }, (_, i) => ({
      id: i + 1,
      interestIds: i === 14 ? [1] : [99],
      traitIds: i % 2 === 0 ? [EXPLORE] : [],
    }));

    const candidates = rankJobCandidates({
      interestIds: [1],
      strengthTraitIds: [EXPLORE, IDEATE, EXPRESS],
      jobs,
    });

    expect(candidates).toHaveLength(JOB_CANDIDATE_COUNT);
    expect(candidates[0]).toEqual({ jobId: 15, score: 5, rank: 1 });
    expect(candidates.slice(1, 8).map((c) => c.jobId)).toEqual([1, 3, 5, 7, 9, 11, 13]);
    expect(candidates.slice(8).map((c) => c.jobId)).toEqual([2, 4]);
    expect(candidates.map((c) => c.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("職業が10件未満なら、あるだけ返す", () => {
    const candidates = rankJobCandidates({
      interestIds: [1],
      strengthTraitIds: [EXPLORE],
      jobs: [
        { id: 2, interestIds: [], traitIds: [] },
        { id: 1, interestIds: [], traitIds: [] },
      ],
    });

    expect(candidates).toEqual([
      { jobId: 1, score: 0, rank: 1 },
      { jobId: 2, score: 0, rank: 2 },
    ]);
  });

  it("実際の職業データ(jobs.json)でも、重複なく10件を返す", () => {
    const INTEREST_CODES = [
      "talk",
      "game",
      "health",
      "nature",
      "research",
      "art",
      "making",
      "animal",
      "food",
      "space",
      "sports",
      "it",
    ];
    const TRAIT_CODES = ["explore", "ideate", "express", "support", "craft"];
    const toIds = (codes: string[], master: string[]) =>
      codes.map((code) => master.indexOf(code) + 1);

    const raw = JSON.parse(
      readFileSync(new URL("../prisma/seed-data/jobs.json", import.meta.url), "utf-8"),
    ) as { id: number; interestCodes: string[]; traitCodes: string[] }[];
    const jobs: JobForMatching[] = raw.map((job) => ({
      id: job.id,
      interestIds: toIds(job.interestCodes, INTEREST_CODES),
      traitIds: toIds(job.traitCodes, TRAIT_CODES),
    }));

    const candidates = rankJobCandidates({
      interestIds: toIds(["space", "it"], INTEREST_CODES),
      strengthTraitIds: [EXPLORE, IDEATE, CRAFT],
      jobs,
    });

    expect(candidates).toHaveLength(JOB_CANDIDATE_COUNT);
    expect(new Set(candidates.map((c) => c.jobId)).size).toBe(JOB_CANDIDATE_COUNT);
    // 衛星データ解析エンジニア(38)：宇宙・星とPC・ITの2つ＋探究・こだわるの2つが一致
    expect(candidates[0]).toEqual({ jobId: 38, score: 2 * 3 + 2 * 2, rank: 1 });
    // 宇宙開発技術者(7)：宇宙・星の1つ＋探究・発想・こだわるの3つが一致
    expect(candidates[1]).toEqual({ jobId: 7, score: 1 * 3 + 3 * 2, rank: 2 });
  });
});
