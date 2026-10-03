const mocks = vi.hoisted(() => ({
  findStudent: vi.fn(),
  findInterests: vi.fn(),
  findOptions: vi.fn(),
  findTraits: vi.fn(),
  findJobs: vi.fn(),
  createDiagnosis: vi.fn(),
  findLatestDiagnosis: vi.fn(),
  generateStrengths: vi.fn(),
}));

vi.mock("../src/lib/prisma.js", () => ({
  prisma: {
    student: { findUnique: mocks.findStudent },
    interest: { findMany: mocks.findInterests },
    questionOption: { findMany: mocks.findOptions },
    trait: { findMany: mocks.findTraits },
    job: { findMany: mocks.findJobs },
    diagnosis: { create: mocks.createDiagnosis, findFirst: mocks.findLatestDiagnosis },
  },
}));

// AI はテストで本物を呼ばない（共有予算を使わない・結果を決まったものにする）
vi.mock("../src/lib/strengthAi.js", () => ({
  generateStrengthDescriptions: mocks.generateStrengths,
}));

import request from "supertest";
import { makeStudentToken, TEST_SESSION_SECRET } from "./helpers/studentToken.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";

// 正しい形の入力。テストごとに一部だけ壊して使う
const VALID_BODY = {
  interestIds: [1, 4],
  answers: [
    { questionId: 1, optionId: 11 },
    { questionId: 2, optionId: 21 },
    { questionId: 3, optionId: 32 },
    { questionId: 4, optionId: 41 },
    { questionId: 5, optionId: 51 },
  ],
};

// DBの代わりのデータ（DB設計 §6.3 の選択肢と特性の対応）
const TRAITS = [
  { id: 1, code: "explore", label: "探究する力", description: "探究の説明", sortOrder: 1 },
  { id: 2, code: "ideate", label: "発想する力", description: "発想の説明", sortOrder: 2 },
  { id: 3, code: "express", label: "表現する力", description: "表現の説明", sortOrder: 3 },
  { id: 4, code: "support", label: "人を支える力", description: "支えるの説明", sortOrder: 4 },
  { id: 5, code: "craft", label: "こだわる力", description: "こだわるの説明", sortOrder: 5 },
];
const OPTIONS = [
  { id: 11, questionId: 1, traitId: 1 },
  { id: 12, questionId: 1, traitId: 2 },
  { id: 21, questionId: 2, traitId: 3 },
  { id: 22, questionId: 2, traitId: 4 },
  { id: 31, questionId: 3, traitId: 2 },
  { id: 32, questionId: 3, traitId: 5 },
  { id: 41, questionId: 4, traitId: 3 },
  { id: 42, questionId: 4, traitId: 4 },
  { id: 51, questionId: 5, traitId: 1 },
  { id: 52, questionId: 5, traitId: 5 },
];
const INTERESTS = [
  { id: 1, label: "人と話す", sortOrder: 1 },
  { id: 4, label: "自然・環境", sortOrder: 4 },
];
const JOBS = [
  { id: 7, interests: [{ interestId: 1 }], traits: [{ traitId: 1 }] },
  { id: 8, interests: [], traits: [{ traitId: 5 }] },
];

describe("POST /v1/diagnoses", () => {
  beforeEach(() => {
    vi.stubEnv("SESSION_SECRET", TEST_SESSION_SECRET);
    mocks.findStudent.mockResolvedValue({ id: 101, schoolId: 7 });
    mocks.findInterests.mockResolvedValue(INTERESTS);
    mocks.findOptions.mockResolvedValue(OPTIONS);
    mocks.findTraits.mockResolvedValue(TRAITS);
    mocks.findJobs.mockResolvedValue(JOBS);
    mocks.createDiagnosis.mockResolvedValue({
      id: 3001,
      createdAt: new Date("2026-10-05T03:21:00Z"),
    });
    // いつもは AI が失敗した（＝固定文）ことにする。既存のテストはこの前提で書かれている
    mocks.generateStrengths.mockResolvedValue(null);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("トークンが無い場合は、401 UNAUTHORIZED を返す", async () => {
    const res = await request(createApp()).post("/v1/diagnoses").send(VALID_BODY);

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: { code: "UNAUTHORIZED", message: "もう一度はじめからお試しください" },
    });
  });

  it("interestIds が0個の場合は、400 VALIDATION_ERROR を返す", async () => {
    const res = await request(createApp())
      .post("/v1/diagnoses")
      .set("Authorization", `Bearer ${makeStudentToken(101, 7)}`)
      .send({ ...VALID_BODY, interestIds: [] });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details[0].field).toBe("interestIds");
  });

  it("interestIds が4個の場合は、400 VALIDATION_ERROR を返す", async () => {
    const res = await request(createApp())
      .post("/v1/diagnoses")
      .set("Authorization", `Bearer ${makeStudentToken(101, 7)}`)
      .send({ ...VALID_BODY, interestIds: [1, 2, 3, 4] });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details[0].field).toBe("interestIds");
  });

  it("interestIds に同じIDが2回含まれる場合は、400 VALIDATION_ERROR を返す", async () => {
    const res = await request(createApp())
      .post("/v1/diagnoses")
      .set("Authorization", `Bearer ${makeStudentToken(101, 7)}`)
      .send({ ...VALID_BODY, interestIds: [1, 1] });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details[0].field).toBe("interestIds");
  });

  it("answers が4件の場合は、400 VALIDATION_ERROR を返す", async () => {
    const res = await request(createApp())
      .post("/v1/diagnoses")
      .set("Authorization", `Bearer ${makeStudentToken(101, 7)}`)
      .send({ ...VALID_BODY, answers: VALID_BODY.answers.slice(0, 4) });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details[0].field).toBe("answers");
  });

  it("questionId に同じIDが2回含まれる場合は、400 VALIDATION_ERROR を返す", async () => {
    const res = await request(createApp())
      .post("/v1/diagnoses")
      .set("Authorization", `Bearer ${makeStudentToken(101, 7)}`)
      .send({
        ...VALID_BODY,
        answers: [
          { questionId: 1, optionId: 11 },
          { questionId: 2, optionId: 21 },
          { questionId: 3, optionId: 32 },
          { questionId: 4, optionId: 41 },
          { questionId: 1, optionId: 11 },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details[0].field).toBe("answers");
  });

  it("questionId に数字と文字列の同じIDが含まれる場合は、400 VALIDATION_ERROR を返し、保存しない", async () => {
    const res = await request(createApp())
      .post("/v1/diagnoses")
      .set("Authorization", `Bearer ${makeStudentToken(101, 7)}`)
      .send({
        ...VALID_BODY,
        answers: [
          { questionId: 1, optionId: 11 },
          { questionId: 2, optionId: 21 },
          { questionId: 3, optionId: 32 },
          { questionId: 4, optionId: 41 },
          { questionId: "1", optionId: 11 },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe("answers");
    expect(mocks.createDiagnosis).not.toHaveBeenCalled();
  });

  it("interestIds に数字と文字列の同じIDが含まれる場合は、400 VALIDATION_ERROR を返し、保存しない", async () => {
    const res = await request(createApp())
      .post("/v1/diagnoses")
      .set("Authorization", `Bearer ${makeStudentToken(101, 7)}`)
      .send({ ...VALID_BODY, interestIds: [1, "1"] });

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe("interestIds");
    expect(mocks.createDiagnosis).not.toHaveBeenCalled();
  });

  it("存在しない interestId を含む場合は、400 VALIDATION_ERROR を返し、保存しない", async () => {
    // DBには id=1 しか無かった、という状況を作る
    mocks.findInterests.mockResolvedValue([INTERESTS[0]]);
    const res = await request(createApp())
      .post("/v1/diagnoses")
      .set("Authorization", `Bearer ${makeStudentToken(101, 7)}`)
      .send(VALID_BODY);

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe("interestIds");
    expect(mocks.createDiagnosis).not.toHaveBeenCalled();
  });

  // 質問1 に、質問2の選択肢（21）で答えた、という状況を作る
  it("answers の選択肢が他の質問のものの場合は、400 VALIDATION_ERROR を返し、保存しない", async () => {
    const res = await request(createApp())
      .post("/v1/diagnoses")
      .set("Authorization", `Bearer ${makeStudentToken(101, 7)}`)
      .send({
        ...VALID_BODY,
        answers: [
          { questionId: 1, optionId: 21 },
          { questionId: 2, optionId: 21 },
          { questionId: 3, optionId: 32 },
          { questionId: 4, optionId: 41 },
          { questionId: 5, optionId: 51 },
        ],
      });

    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe("answers");
    expect(mocks.createDiagnosis).not.toHaveBeenCalled();
  });

  it("正しい入力の場合は、診断を保存して 201 と強み3つ・職業候補の件数を返す", async () => {
    const res = await request(createApp())
      .post("/v1/diagnoses")
      .set("Authorization", `Bearer ${makeStudentToken(101, 7)}`)
      .send(VALID_BODY);

    // ① レスポンス
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: 3001,
      createdAt: "2026-10-05T03:21:00.000Z",
      strengths: [
        { code: "explore", title: "探究する力", description: "探究の説明" },
        { code: "express", title: "表現する力", description: "表現の説明" },
        { code: "craft", title: "こだわる力", description: "こだわるの説明" },
      ],
      jobCount: 2,
    });

    // ② 保存に渡した中身（1回だけ呼ばれ、AI が使えなかった＝固定文の印が付いている）
    expect(mocks.createDiagnosis).toHaveBeenCalledTimes(1);
    const data = mocks.createDiagnosis.mock.calls[0][0].data;
    expect(data).toMatchObject({ studentId: 101, usedFallback: true, aiModel: null });

    // ③ 職業候補と「なぜつながる？」
    expect(data.jobs.create).toEqual([
      {
        rank: 1,
        jobId: 7,
        score: 5,
        whyText:
          "あなたが選んだ「人と話す」への興味と、「探究する力」がこの仕事につながっているかもしれません。",
      },
      {
        rank: 2,
        jobId: 8,
        score: 2,
        whyText: "「こだわる力」があなたの強みとして、この仕事につながっているかもしれません。",
      },
    ]);
  });

  it("AI が説明文を作れた場合は、AI の文で保存して返す（usedFallback: false・ai_model を保存）", async () => {
    // このテストだけ、AI が成功したことにする
    mocks.generateStrengths.mockResolvedValue({
      descriptions: new Map([
        ["explore", "AIが考えた探究の説明がありそう。"],
        ["express", "AIが考えた表現の説明がありそう。"],
        ["craft", "AIが考えたこだわるの説明がありそう。"],
      ]),
      model: "openai/gpt-oss-120b",
    });

    const res = await request(createApp())
      .post("/v1/diagnoses")
      .set("Authorization", `Bearer ${makeStudentToken(101, 7)}`)
      .send(VALID_BODY);

    // ① レスポンスの説明文が AI の文になっている
    expect(res.status).toBe(201);
    expect(res.body.strengths).toEqual([
      { code: "explore", title: "探究する力", description: "AIが考えた探究の説明がありそう。" },
      { code: "express", title: "表現する力", description: "AIが考えた表現の説明がありそう。" },
      { code: "craft", title: "こだわる力", description: "AIが考えたこだわるの説明がありそう。" },
    ]);

    // ② 保存も AI の文で、AI を使えた印が付いている
    const data = mocks.createDiagnosis.mock.calls[0][0].data;
    expect(data).toMatchObject({ usedFallback: false, aiModel: "openai/gpt-oss-120b" });
    expect(data.strengths.create.map((s: { description: string }) => s.description)).toEqual([
      "AIが考えた探究の説明がありそう。",
      "AIが考えた表現の説明がありそう。",
      "AIが考えたこだわるの説明がありそう。",
    ]);
  });
});

describe("GET /v1/diagnoses/latest", () => {
  beforeEach(() => {
    vi.stubEnv("SESSION_SECRET", TEST_SESSION_SECRET);
    mocks.findStudent.mockResolvedValue({ id: 101, schoolId: 7 });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("トークンが無い場合は、401 UNAUTHORIZED を返す", async () => {
    const res = await request(createApp()).get("/v1/diagnoses/latest");

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: { code: "UNAUTHORIZED", message: "もう一度はじめからお試しください" },
    });
  });

  it("診断がまだ無い場合は、404 DIAGNOSIS_NOT_FOUND を返す", async () => {
    mocks.findLatestDiagnosis.mockResolvedValue(null);

    const res = await request(createApp())
      .get("/v1/diagnoses/latest")
      .set("Authorization", `Bearer ${makeStudentToken(101, 7)}`);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: { code: "DIAGNOSIS_NOT_FOUND", message: "診断結果が見つかりません" },
    });
  });

  it("トークンの生徒の診断だけを、created_at の新しい順（同じなら id の大きい順）で探す", async () => {
    mocks.findLatestDiagnosis.mockResolvedValue(null);

    await request(createApp())
      .get("/v1/diagnoses/latest")
      .set("Authorization", `Bearer ${makeStudentToken(101, 7)}`);

    const args = mocks.findLatestDiagnosis.mock.calls[0][0];
    expect(args.where).toEqual({ studentId: 101 });
    expect(args.orderBy).toEqual([{ createdAt: "desc" }, { id: "desc" }]);
  });

  it("診断がある場合は、200 と POST の 201 と同じ形で返す", async () => {
    mocks.findLatestDiagnosis.mockResolvedValue({
      id: 3001,
      createdAt: new Date("2026-10-05T03:21:00Z"),
      strengths: [
        { description: "探究の説明", trait: { code: "explore", label: "探究する力" } },
        { description: "表現の説明", trait: { code: "express", label: "表現する力" } },
        { description: "こだわるの説明", trait: { code: "craft", label: "こだわる力" } },
      ],
      _count: { jobs: 10 },
    });

    const res = await request(createApp())
      .get("/v1/diagnoses/latest")
      .set("Authorization", `Bearer ${makeStudentToken(101, 7)}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: 3001,
      createdAt: "2026-10-05T03:21:00.000Z",
      strengths: [
        { code: "explore", title: "探究する力", description: "探究の説明" },
        { code: "express", title: "表現する力", description: "表現の説明" },
        { code: "craft", title: "こだわる力", description: "こだわるの説明" },
      ],
      jobCount: 10,
    });
  });
});

describe("GET /v1/diagnoses/latest/jobs", () => {
  beforeEach(() => {
    vi.stubEnv("SESSION_SECRET", TEST_SESSION_SECRET);
    mocks.findStudent.mockResolvedValue({ id: 101, schoolId: 7 });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("トークンが無い場合は、401 UNAUTHORIZED を返す", async () => {
    const res = await request(createApp()).get("/v1/diagnoses/latest/jobs");

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: { code: "UNAUTHORIZED", message: "もう一度はじめからお試しください" },
    });
  });

  it("診断がまだ無い場合は、404 DIAGNOSIS_NOT_FOUND を返す", async () => {
    mocks.findLatestDiagnosis.mockResolvedValue(null);

    const res = await request(createApp())
      .get("/v1/diagnoses/latest/jobs")
      .set("Authorization", `Bearer ${makeStudentToken(101, 7)}`);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      error: { code: "DIAGNOSIS_NOT_FOUND", message: "診断結果が見つかりません" },
    });
  });

  it("トークンの生徒の診断だけを、created_at の新しい順（同じなら id の大きい順）で探す", async () => {
    mocks.findLatestDiagnosis.mockResolvedValue(null);

    await request(createApp())
      .get("/v1/diagnoses/latest/jobs")
      .set("Authorization", `Bearer ${makeStudentToken(101, 7)}`);

    const args = mocks.findLatestDiagnosis.mock.calls[0][0];
    expect(args.where).toEqual({ studentId: 101 });
    expect(args.orderBy).toEqual([{ createdAt: "desc" }, { id: "desc" }]);
  });

  it("診断がある場合は、200 と職業候補の一覧を返す（スコアは返さない）", async () => {
    // ここがモックデータ：DBがこの診断を返したことにする
    mocks.findLatestDiagnosis.mockResolvedValue({
      jobs: [
        {
          job: {
            id: 7,
            name: "宇宙開発技術者",
            summary: "ロケットや人工衛星を設計・開発する仕事です。",
            imageUrl: null,
            emoji: "🛰",
            // わざと sortOrder の大きい方を先にして、並び替えを確かめる
            interests: [
              { interest: { label: "宇宙・星", sortOrder: 10 } },
              { interest: { label: "調べる・研究", sortOrder: 5 } },
            ],
          },
        },
      ],
    });

    const res = await request(createApp())
      .get("/v1/diagnoses/latest/jobs")
      .set("Authorization", `Bearer ${makeStudentToken(101, 7)}`);

    // ここが答え合わせ
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      items: [
        {
          id: 7,
          name: "宇宙開発技術者",
          summary: "ロケットや人工衛星を設計・開発する仕事です。",
          interestTags: ["調べる・研究", "宇宙・星"],
          imageUrl: null,
          emoji: "🛰",
        },
      ],
    });
  });
});
