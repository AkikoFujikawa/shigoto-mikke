import { describe, expect, it } from "vitest";
import { DESCRIPTION_MAX_LENGTH, validateStrengthDescriptions } from "../src/lib/strengthAi.js";

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

  it("出力の形がそもそも違う（文字列）場合は、null を返す", () => {
    const result = validateStrengthDescriptions("こんにちは", EXPECTED_CODES);

    expect(result).toBeNull();
  });
});
