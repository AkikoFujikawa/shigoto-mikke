const mocks = vi.hoisted(() => ({
  redisGet: vi.fn(),
  redisSet: vi.fn(),
}));

// Redis だけを偽物にする。キャッシュの共通処理（lib/cache.ts）と検証（lib/strengthAi.ts）は本物を使う
vi.mock("../src/lib/redis.js", () => ({
  redis: { get: mocks.redisGet, set: mocks.redisSet },
}));

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AI_MODEL, type StrengthForAi } from "../src/lib/strengthAi.js";
import {
  STRENGTH_CACHE_TTL_SECONDS,
  describeStrengths,
  strengthCacheKey,
} from "../src/lib/strengthCache.js";

const STRENGTHS: StrengthForAi[] = [
  { code: "explore", label: "探究する力", description: "探究の説明" },
  { code: "express", label: "表現する力", description: "表現の説明" },
  { code: "craft", label: "こだわる力", description: "こだわるの説明" },
];

const AI_TEXTS: [string, string][] = [
  ["explore", "気になることを、深く調べたくなるところがありそう。"],
  ["express", "自分の考えを、わかりやすく伝えられるところがありそう。"],
  ["craft", "細かいところまで、ていねいに仕上げるところがありそう。"],
];

// Redis に保存される形（AI の出力と同じ、配列の形）
const SAVED = {
  model: AI_MODEL,
  strengths: AI_TEXTS.map(([code, description]) => ({ code, description })),
};

/** AI が成功したことにする、偽物の係 */
const generateOk = () =>
  vi.fn().mockResolvedValue({ descriptions: new Map(AI_TEXTS), model: AI_MODEL });

beforeEach(() => {
  mocks.redisGet.mockResolvedValue(null);
  mocks.redisSet.mockResolvedValue("OK");
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("describeStrengths（#70）", () => {
  describe("保存済みの文が無いとき", () => {
    it("AI で作った文を返し、24時間の期限で保存する", async () => {
      const generate = generateOk();

      const result = await describeStrengths(STRENGTHS, generate);

      expect(generate).toHaveBeenCalledWith(STRENGTHS);
      expect(result).toEqual({
        descriptions: new Map(AI_TEXTS),
        model: AI_MODEL,
        fromCache: false,
      });
      expect(mocks.redisSet).toHaveBeenCalledWith(
        strengthCacheKey(STRENGTHS),
        JSON.stringify(SAVED),
        "EX",
        STRENGTH_CACHE_TTL_SECONDS,
      );
      expect(STRENGTH_CACHE_TTL_SECONDS).toBe(24 * 60 * 60);
    });

    it("AI が失敗（null）した場合は null を返し、保存しない", async () => {
      const generate = vi.fn().mockResolvedValue(null);

      const result = await describeStrengths(STRENGTHS, generate);

      expect(result).toBeNull();
      expect(mocks.redisSet).not.toHaveBeenCalled();
    });
  });

  describe("保存済みの文があるとき", () => {
    it("AI を呼ばずに、保存済みの文を返す", async () => {
      mocks.redisGet.mockResolvedValue(JSON.stringify(SAVED));
      const generate = generateOk();

      const result = await describeStrengths(STRENGTHS, generate);

      expect(result).toEqual({
        descriptions: new Map(AI_TEXTS),
        model: AI_MODEL,
        fromCache: true,
      });
      expect(mocks.redisGet).toHaveBeenCalledWith(strengthCacheKey(STRENGTHS));
      expect(generate).not.toHaveBeenCalled();
      expect(mocks.redisSet).not.toHaveBeenCalled();
    });

    it.each([
      [
        "今の検証を通らない文（壊れた出力）が入っている",
        {
          model: AI_MODEL,
          strengths: [
            SAVED.strengths[0],
            SAVED.strengths[1],
            { code: "craft", description: "新しいアイ歩???" },
          ],
        },
      ],
      ["強みが1つ足りない", { model: AI_MODEL, strengths: SAVED.strengths.slice(0, 2) }],
      ["モデル名が無い", { strengths: SAVED.strengths }],
      ["形がちがう", { foo: "bar" }],
    ])("保存済みの値が使えない（%s）場合は、AI で作り直して保存し直す", async (_name, saved) => {
      mocks.redisGet.mockResolvedValue(JSON.stringify(saved));
      const generate = generateOk();

      const result = await describeStrengths(STRENGTHS, generate);

      expect(generate).toHaveBeenCalledTimes(1);
      expect(result?.fromCache).toBe(false);
      expect(mocks.redisSet).toHaveBeenCalledTimes(1);
    });
  });

  describe("Redis が使えないとき", () => {
    it("取得に失敗しても、AI で作った文を返す", async () => {
      mocks.redisGet.mockRejectedValue(new Error("Redis down"));
      const generate = generateOk();

      const result = await describeStrengths(STRENGTHS, generate);

      expect(result?.descriptions).toEqual(new Map(AI_TEXTS));
      expect(result?.fromCache).toBe(false);
    });

    it("保存に失敗しても、AI で作った文を返す", async () => {
      mocks.redisSet.mockRejectedValue(new Error("Redis down"));

      const result = await describeStrengths(STRENGTHS, generateOk());

      expect(result?.descriptions).toEqual(new Map(AI_TEXTS));
    });
  });
});

describe("strengthCacheKey（#70）", () => {
  const withDescription = (description: string): StrengthForAi[] => [
    STRENGTHS[0],
    STRENGTHS[1],
    { ...STRENGTHS[2], description },
  ];

  it("同じ強み3つなら、同じキーになる（ai:strengths: で始まる）", () => {
    const key = strengthCacheKey(STRENGTHS);

    expect(key).toMatch(/^ai:strengths:[0-9a-f]{64}$/);
    expect(strengthCacheKey(STRENGTHS.map((s) => ({ ...s })))).toBe(key);
  });

  it("強みの組み合わせがちがえば、キーもちがう", () => {
    const other: StrengthForAi[] = [
      STRENGTHS[0],
      STRENGTHS[1],
      { code: "support", label: "人を支える力", description: "人を支えるの説明" },
    ];

    expect(strengthCacheKey(other)).not.toBe(strengthCacheKey(STRENGTHS));
  });

  it("AI に渡す説明（traits.description）が変われば、キーも変わる（古い文を使い続けない）", () => {
    expect(strengthCacheKey(withDescription("こだわるの新しい説明"))).not.toBe(
      strengthCacheKey(STRENGTHS),
    );
  });

  it("生徒の入力や個人情報は、キーに入らない（強みの code・特性名・説明だけで決まる）", () => {
    const withExtra = STRENGTHS.map((s) => ({ ...s, id: 99, sortOrder: 1, nickname: "みさき" }));

    expect(strengthCacheKey(withExtra)).toBe(strengthCacheKey(STRENGTHS));
  });
});
