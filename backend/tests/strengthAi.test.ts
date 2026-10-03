import { describe, expect, it, vi } from "vitest";
import {
  AI_MODEL,
  DESCRIPTION_MAX_LENGTH,
  buildMessages,
  generateStrengthDescriptions,
  validateStrengthDescriptions,
  type StrengthForAi,
} from "../src/lib/strengthAi.js";

// 今回の診断で決まった強み3つ（sort_order 順）
const EXPECTED_CODES = ["explore", "express", "craft"];

// AI が返してくる、正しい形の出力
const VALID_OUTPUT = {
  strengths: [
    { code: "explore", description: "気になったことを、深く調べられるところがありそう。" },
    { code: "express", description: "自分の考えを、わかりやすく伝えられるところがありそう。" },
    { code: "craft", description: "細かいところまで、丁寧にやり切れるかも。" },
  ],
};

describe("validateStrengthDescriptions", () => {
  it("正しい出力の場合は、code ごとの説明文を返す", () => {
    const result = validateStrengthDescriptions(VALID_OUTPUT, EXPECTED_CODES);

    expect(result?.get("explore")).toBe("気になったことを、深く調べられるところがありそう。");
    expect(result?.get("express")).toBe("自分の考えを、わかりやすく伝えられるところがありそう。");
    expect(result?.get("craft")).toBe("細かいところまで、丁寧にやり切れるかも。");
  });

  it("強みが2つしかない場合は、null を返す", () => {
    const result = validateStrengthDescriptions(
      {
        strengths: VALID_OUTPUT.strengths.slice(0, 2),
      },
      EXPECTED_CODES,
    );

    expect(result).toBeNull();
  });

  it("今回の強みにない特性が混ざっている場合は、null を返す", () => {
    const result = validateStrengthDescriptions(
      {
        strengths: [
          VALID_OUTPUT.strengths[0],
          VALID_OUTPUT.strengths[1],
          { code: "ideate", description: "新しいアイデアを考えるのが楽しめるかも。" },
        ],
      },
      EXPECTED_CODES,
    );

    expect(result).toBeNull();
  });

  it("説明文が長すぎる（201文字）場合は、null を返す", () => {
    const result = validateStrengthDescriptions(
      {
        strengths: [
          VALID_OUTPUT.strengths[0],
          VALID_OUTPUT.strengths[1],
          { code: "craft", description: "あ".repeat(DESCRIPTION_MAX_LENGTH + 1) },
        ],
      },
      EXPECTED_CODES,
    );

    expect(result).toBeNull();
  });

  it("説明文がちょうど200文字の場合は、OK として返す", () => {
    const result = validateStrengthDescriptions(
      {
        strengths: [
          VALID_OUTPUT.strengths[0],
          VALID_OUTPUT.strengths[1],
          { code: "craft", description: "あ".repeat(DESCRIPTION_MAX_LENGTH) },
        ],
      },
      EXPECTED_CODES,
    );

    expect(result?.get("craft")).toBe("あ".repeat(DESCRIPTION_MAX_LENGTH));
  });

  it("断定表現（「理系に向いている」）を含む場合は、null を返す", () => {
    const result = validateStrengthDescriptions(
      {
        strengths: [
          VALID_OUTPUT.strengths[0],
          VALID_OUTPUT.strengths[1],
          { code: "craft", description: "理系に向いているかもしれません。" },
        ],
      },
      EXPECTED_CODES,
    );

    expect(result).toBeNull();
  });

  it.each([
    "理系の勉強をするとよさそう。",
    "この仕事に向いているかも。",
    "必ず活かせる力がありそう。",
    "詳しくは https://example.com を見てね。",
    "もっと学ぶべきかもしれません。",
  ])("禁止表現（%s）を含む場合は、null を返す", (description) => {
    const result = validateStrengthDescriptions(
      {
        strengths: [
          VALID_OUTPUT.strengths[0],
          VALID_OUTPUT.strengths[1],
          { code: "craft", description },
        ],
      },
      EXPECTED_CODES,
    );

    expect(result).toBeNull();
  });

  it.each(["最後まで調べきる力がありそう。", "食べきれないほどの好奇心がありそう。"])(
    "「べき」を含む普通の言葉（%s）は、OK として返す",
    (description) => {
      const result = validateStrengthDescriptions(
        {
          strengths: [
            VALID_OUTPUT.strengths[0],
            VALID_OUTPUT.strengths[1],
            { code: "craft", description },
          ],
        },
        EXPECTED_CODES,
      );

      expect(result?.get("craft")).toBe(description);
    },
  );

  it("出力の形がそもそも違う（文字列）場合は、null を返す", () => {
    const result = validateStrengthDescriptions("こんにちは", EXPECTED_CODES);

    expect(result).toBeNull();
  });
});

// 今回の診断で決まった強み3つ（AI に渡すもの）
const STRENGTHS: StrengthForAi[] = [
  { code: "explore", label: "探究する力", description: "探究の説明" },
  { code: "express", label: "表現する力", description: "表現の説明" },
  { code: "craft", label: "こだわる力", description: "こだわるの説明" },
];

describe("generateStrengthDescriptions", () => {
  it("AI が正しい出力を返した場合は、説明文とモデル名を返す", async () => {
    // 偽物の AI：いつも正しい JSON を返す
    const request = vi.fn().mockResolvedValue(JSON.stringify(VALID_OUTPUT));

    const result = await generateStrengthDescriptions(STRENGTHS, request);

    expect(result?.model).toBe(AI_MODEL);
    expect(result?.descriptions.get("explore")).toBe(
      "気になったことを、深く調べられるところがありそう。",
    );
    expect(request).toHaveBeenCalledWith(STRENGTHS);
  });

  it("AI がエラー・タイムアウトを起こした場合は、null を返す", async () => {
    // 偽物の AI：エラー（タイムアウト）を投げる
    const request = vi.fn().mockRejectedValue(new Error("timeout"));

    const result = await generateStrengthDescriptions(STRENGTHS, request);

    expect(result).toBeNull();
  });

  it("AI の返事が JSON ではない場合は、null を返す", async () => {
    // 偽物の AI：JSON ではない文章を返す
    const request = vi.fn().mockResolvedValue("すみません、うまく答えられませんでした。");
    const result = await generateStrengthDescriptions(STRENGTHS, request);

    expect(result).toBeNull();
  });

  it("AI の返事に断定表現が入っていた場合は、null を返す", async () => {
    // 偽物の AI：形は正しいが、断定表現の入った JSON を返す
    const request = vi.fn().mockResolvedValue(
      JSON.stringify({
        strengths: [
          VALID_OUTPUT.strengths[0],
          VALID_OUTPUT.strengths[1],
          { code: "craft", description: "理系に向いているかもしれません。" },
        ],
      }),
    );

    const result = await generateStrengthDescriptions(STRENGTHS, request);

    expect(result).toBeNull();
  });

  it("AI の返事が空（null）の場合は、null を返す", async () => {
    // 偽物の AI：中身が空の返事を返す
    const request = vi.fn().mockResolvedValue(null);
    const result = await generateStrengthDescriptions(STRENGTHS, request);

    expect(result).toBeNull();
  });
});

describe("buildMessages", () => {
  it("AI には、強みの code・特性名・説明だけを送る（ニックネームなどは送らない）", () => {
    // うっかりニックネームが混ざったデータを渡す
    const strengthsWithNickname = STRENGTHS.map((s) => ({ ...s, nickname: "みさき" }));

    const messages = buildMessages(strengthsWithNickname);
    const sent = JSON.parse(messages[1].content);

    expect(sent).toEqual({ strengths: STRENGTHS });
    expect(messages[1].content).not.toContain("みさき");
  });
});
