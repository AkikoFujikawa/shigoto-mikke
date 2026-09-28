const mocks = vi.hoisted(() => ({
  findStudent: vi.fn(),
  findJob: vi.fn(),
  findDiagnosis: vi.fn(),
  redisGet: vi.fn(),
  redisSet: vi.fn(),
}));

vi.mock("../src/lib/prisma.js", () => ({
  prisma: {
    student: { findUnique: mocks.findStudent },
    job: { findFirst: mocks.findJob },
    diagnosis: { findFirst: mocks.findDiagnosis },
  },
}));

vi.mock("../src/lib/redis.js", () => ({
  redis: { get: mocks.redisGet, set: mocks.redisSet },
}));

import request from "supertest";
import { makeStudentToken, TEST_SESSION_SECRET } from "./helpers/studentToken.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";

const SPACE = { id: 10, label: "宇宙・星", sortOrder: 10 };
const IT = { id: 12, label: "PC・IT", sortOrder: 12 };
const RESEARCH = { id: 5, label: "調べる・研究", sortOrder: 5 };
const EXPLORE = { id: 1, label: "探究する力", sortOrder: 1 };
const CRAFT = { id: 5, label: "こだわる力", sortOrder: 5 };

// DBから読んだ職業（関連テーブルの並びは、わざと sortOrder 順にしていない）
const DB_JOB = {
  id: 7,
  name: "宇宙開発技術者",
  imageUrl: null,
  description: "ロケットや人工衛星の設計・開発・試験を行う仕事です。",
  group: { name: "研究・自然・工学・ものづくり" },
  interests: [{ interest: SPACE }, { interest: RESEARCH }],
  traits: [{ traitId: EXPLORE.id }],
  academics: [
    { academicField: { name: "情報学", category: "science", sortOrder: 20 } },
    { academicField: { name: "工学（機械・電気）", category: "science", sortOrder: 10 } },
    { academicField: { name: "地理学", category: "mixed", sortOrder: 30 } },
  ],
};

// キャッシュに入る形（生徒によって変わらない部分）
const CACHED_JOB = {
  id: 7,
  name: "宇宙開発技術者",
  group: "研究・自然・工学・ものづくり",
  interestTags: ["調べる・研究", "宇宙・星"],
  imageUrl: null,
  description: "ロケットや人工衛星の設計・開発・試験を行う仕事です。",
  academics: [
    { name: "工学（機械・電気）", category: "science" },
    { name: "情報学", category: "science" },
    { name: "地理学", category: "mixed" },
  ],
  interestIds: [RESEARCH.id, SPACE.id],
  traitIds: [EXPLORE.id],
};

// 「宇宙・星」「PC・IT」を選び、強みに「探究する力」「こだわる力」が入った診断
function diagnosis(savedWhyText?: string) {
  return {
    jobs: savedWhyText ? [{ whyText: savedWhyText }] : [],
    interests: [{ interest: IT }, { interest: SPACE }],
    strengths: [{ trait: CRAFT }, { trait: EXPLORE }],
  };
}

function getJob(jobId: string | number) {
  return request(createApp())
    .get(`/v1/jobs/${jobId}`)
    .set("Authorization", `Bearer ${makeStudentToken(101, 7)}`);
}

describe("GET /v1/jobs/:jobId", () => {
  beforeEach(() => {
    vi.stubEnv("SESSION_SECRET", TEST_SESSION_SECRET);
    mocks.findStudent.mockResolvedValue({ id: 101, schoolId: 7 });
    mocks.findJob.mockResolvedValue(DB_JOB);
    mocks.findDiagnosis.mockResolvedValue(diagnosis());
    mocks.redisGet.mockResolvedValue(null);
    mocks.redisSet.mockResolvedValue("OK");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("トークンが無い場合は、401 UNAUTHORIZED を返す", async () => {
    const res = await request(createApp()).get("/v1/jobs/7");

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: { code: "UNAUTHORIZED", message: "もう一度はじめからお試しください" },
    });
  });

  it("jobId が整数でない場合は、400 VALIDATION_ERROR を返す", async () => {
    const res = await getJob("abc");

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details[0].field).toBe("jobId");
    expect(mocks.findJob).not.toHaveBeenCalled();
  });

  it("職業が無い（または非公開）場合は、404 JOB_NOT_FOUND を返し、キャッシュしない", async () => {
    mocks.findJob.mockResolvedValue(null);

    const res = await getJob(999);

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: "JOB_NOT_FOUND", message: "職業が見つかりません" } });
    expect(mocks.findJob).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 999, isPublished: true } }),
    );
    expect(mocks.redisSet).not.toHaveBeenCalled();
  });

  it("API設計 §3.6 の形で返す。タグと学問は sortOrder 順で、文理は学問にだけ付く", async () => {
    const res = await getJob(7);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: 7,
      name: "宇宙開発技術者",
      group: "研究・自然・工学・ものづくり",
      interestTags: ["調べる・研究", "宇宙・星"],
      imageUrl: null,
      whyConnected:
        "あなたが選んだ「宇宙・星」への興味と、「探究する力」がこの仕事につながっているかもしれません。",
      description: "ロケットや人工衛星の設計・開発・試験を行う仕事です。",
      academics: [
        { name: "工学（機械・電気）", category: "science" },
        { name: "情報学", category: "science" },
        { name: "地理学", category: "mixed" },
      ],
    });
  });

  it("最新の診断の候補に入っている職業は、保存済みの文をそのまま返す", async () => {
    mocks.findDiagnosis.mockResolvedValue(diagnosis("保存済みの文です。"));

    const res = await getJob(7);

    expect(res.body.whyConnected).toBe("保存済みの文です。");
    expect(mocks.findDiagnosis).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { studentId: 101 },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      }),
    );
  });

  it("候補に入っていない職業は、最新の診断の好きなもの・強みから、その場で文を作る", async () => {
    // 職業のタグと一致するのは「宇宙・星」だけ（強みは一致しない）
    mocks.findJob.mockResolvedValue({ ...DB_JOB, traits: [] });

    const res = await getJob(7);

    expect(res.body.whyConnected).toBe(
      "あなたが選んだ「宇宙・星」への興味が、この仕事につながっているかもしれません。",
    );
  });

  it("診断がまだない場合は、「この仕事も、…」の文を返す", async () => {
    mocks.findDiagnosis.mockResolvedValue(null);

    const res = await getJob(7);

    expect(res.status).toBe(200);
    expect(res.body.whyConnected).toBe("この仕事も、あなたにつながっているかもしれません。");
  });

  it("キャッシュが無いときは、DBから読んで Redis に1時間キャッシュする", async () => {
    await getJob(7);

    expect(mocks.redisSet).toHaveBeenCalledWith(
      "master:job:7",
      JSON.stringify(CACHED_JOB),
      "EX",
      3600,
    );
  });

  it("キャッシュがあるときは、職業をDBから読まない。whyConnected は毎回診断から決める", async () => {
    mocks.redisGet.mockResolvedValue(JSON.stringify(CACHED_JOB));
    mocks.findDiagnosis.mockResolvedValue(diagnosis("保存済みの文です。"));

    const res = await getJob(7);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("宇宙開発技術者");
    expect(res.body.whyConnected).toBe("保存済みの文です。");
    expect(mocks.findJob).not.toHaveBeenCalled();
    expect(mocks.findDiagnosis).toHaveBeenCalled();
  });

  it("Redis が使えなくても、DBから読んで 200 を返す", async () => {
    mocks.redisGet.mockRejectedValue(new Error("Redis down"));
    mocks.redisSet.mockRejectedValue(new Error("Redis down"));

    const res = await getJob(7);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe("宇宙開発技術者");
  });
});
