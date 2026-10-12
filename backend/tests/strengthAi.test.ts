const mocks = vi.hoisted(() => ({ logWarn: vi.fn() }));

// 固定文になった理由が、ログに出ることを確かめる（#72）
vi.mock("../src/config/logger.js", () => ({
  logger: { info: vi.fn(), warn: mocks.logWarn, error: vi.fn() },
}));

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AI_MODEL,
  DESCRIPTION_MAX_LENGTH,
  DESCRIPTION_MIN_LENGTH,
  buildMessages,
  checkStrengthDescriptions,
  generateStrengthDescriptions,
  validateStrengthDescriptions,
  type StrengthForAi,
} from "../src/lib/strengthAi.js";

afterEach(() => {
  vi.clearAllMocks();
});

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
          { code: "craft", description: "あ".repeat(DESCRIPTION_MAX_LENGTH) + "。" },
        ],
      },
      EXPECTED_CODES,
    );

    expect(result).toBeNull();
  });

  it("説明文がちょうど200文字の場合は、OK として返す", () => {
    // AI には「。」で終わる文を頼んでいるので、例文も「。」で終える（#137）
    const text = "あ".repeat(DESCRIPTION_MAX_LENGTH - 1) + "。";
    const result = validateStrengthDescriptions(
      {
        strengths: [
          VALID_OUTPUT.strengths[0],
          VALID_OUTPUT.strengths[1],
          { code: "craft", description: text },
        ],
      },
      EXPECTED_CODES,
    );

    expect(result?.get("craft")).toBe(text);
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
    "理系の勉強をすると、力を伸ばせそうかも。",
    "この仕事に向いているところがありそう。",
    "必ず活かせる力を持っているところがありそう。",
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

  describe("壊れた出力を弾く（#137）", () => {
    // 3つ目（craft）の説明文だけを差しかえて、チェックする
    const withCraft = (description: string) =>
      validateStrengthDescriptions(
        {
          strengths: [
            VALID_OUTPUT.strengths[0],
            VALID_OUTPUT.strengths[1],
            { code: "craft", description },
          ],
        },
        EXPECTED_CODES,
      );

    it("説明文がちょうど15文字の場合は、OK として返す", () => {
      const text = "あ".repeat(DESCRIPTION_MIN_LENGTH - 1) + "。";
      expect(withCraft(text)?.get("craft")).toBe(text);
    });

    it("説明文が短すぎる（14文字）場合は、null を返す", () => {
      expect(withCraft("あ".repeat(DESCRIPTION_MIN_LENGTH - 2) + "。")).toBeNull();
    });

    it.each([
      ["半角の「?」が続く", "新しいアイデアを次々に???思いつくところがありそう。"],
      ["全角の「？」が続く", "新しいアイデアを次々に？？思いつくところがありそう。"],
      ["文字化け（U+FFFD）を含む", "新しいアイデアを次々に\uFFFD\uFFFD思いつくところがありそう。"],
      ["「。」で終わらない（途中で切れた文）", "新しいアイデアを次々に思いつくところがありそう"],
      ["実際に出た壊れた文（「新しいアイ歩???」）", "新しいアイ歩???"],
    ])("%s場合は、null を返す", (_label, description) => {
      expect(withCraft(description)).toBeNull();
    });

    it("「？」が1つだけの場合は、OK として返す（弾きすぎない）", () => {
      const text = "どうしてだろう？と気になることを、調べたくなるところがありそう。";
      expect(withCraft(text)?.get("craft")).toBe(text);
    });
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

describe("AI の文を使えなかった理由を、ログに出す（#72）", () => {
  const MESSAGE = "AI の強みの説明を使えませんでした";

  // 3つ目（craft）の説明文だけを差しかえた、AI の返事
  const outputWithCraft = (description: string) =>
    JSON.stringify({
      strengths: [
        VALID_OUTPUT.strengths[0],
        VALID_OUTPUT.strengths[1],
        { code: "craft", description },
      ],
    });

  it("AI の文を使えた場合は、ログを出さない", async () => {
    const request = vi.fn().mockResolvedValue(JSON.stringify(VALID_OUTPUT));

    await generateStrengthDescriptions(STRENGTHS, request);

    expect(mocks.logWarn).not.toHaveBeenCalled();
  });

  it.each([
    ["短すぎる", "新しいアイ歩。", "too_short"],
    ["長すぎる", "あ".repeat(DESCRIPTION_MAX_LENGTH) + "。", "too_long"],
    ["禁止表現を含む", "理系の勉強をすると、力を伸ばせそうかも。", "forbidden_word"],
    ["「?」が続く", "新しいアイデアを次々に???思いつくところがありそう。", "broken_text"],
    ["「。」で終わらない", "新しいアイデアを次々に思いつくところがありそう", "no_period"],
  ])("説明文が%s場合は、理由・強みの code・その文を出す", async (_name, description, reason) => {
    const request = vi.fn().mockResolvedValue(outputWithCraft(description));

    const result = await generateStrengthDescriptions(STRENGTHS, request);

    expect(result).toBeNull();
    expect(mocks.logWarn).toHaveBeenCalledTimes(1);
    expect(mocks.logWarn).toHaveBeenCalledWith(
      { reason, code: "craft", description: description.slice(0, 200) },
      MESSAGE,
    );
  });

  it("形がちがう（強みが1つ足りない）場合は、invalid_shape を出す", async () => {
    const request = vi
      .fn()
      .mockResolvedValue(JSON.stringify({ strengths: VALID_OUTPUT.strengths.slice(0, 2) }));

    await generateStrengthDescriptions(STRENGTHS, request);

    expect(mocks.logWarn).toHaveBeenCalledWith({ reason: "invalid_shape" }, MESSAGE);
  });

  it("JSON ではない返事の場合は、invalid_json と、返事のはじめの部分を出す", async () => {
    const request = vi.fn().mockResolvedValue("すみません、うまく答えられませんでした。");

    await generateStrengthDescriptions(STRENGTHS, request);

    expect(mocks.logWarn).toHaveBeenCalledWith(
      { reason: "invalid_json", content: "すみません、うまく答えられませんでした。" },
      MESSAGE,
    );
  });

  it("返事が空の場合は、empty_response を出す", async () => {
    await generateStrengthDescriptions(STRENGTHS, vi.fn().mockResolvedValue(null));

    expect(mocks.logWarn).toHaveBeenCalledWith({ reason: "empty_response" }, MESSAGE);
  });

  it("タイムアウトの場合は、timeout と、エラーの種類・文を出す", async () => {
    const err = Object.assign(new Error("Request timed out."), {
      name: "APIConnectionTimeoutError",
    });

    await generateStrengthDescriptions(STRENGTHS, vi.fn().mockRejectedValue(err));

    expect(mocks.logWarn).toHaveBeenCalledWith(
      { reason: "timeout", errName: "APIConnectionTimeoutError", errMessage: "Request timed out." },
      MESSAGE,
    );
  });

  it("AI のサービスがエラーを返した場合は、request_failed と、HTTP の状態を出す", async () => {
    const err = Object.assign(new Error("429 Rate limit exceeded"), {
      name: "RateLimitError",
      status: 429,
      headers: { "x-secret": "should-not-be-logged" },
    });

    await generateStrengthDescriptions(STRENGTHS, vi.fn().mockRejectedValue(err));

    expect(mocks.logWarn).toHaveBeenCalledWith(
      {
        reason: "request_failed",
        errName: "RateLimitError",
        errMessage: "429 Rate limit exceeded",
        status: 429,
      },
      MESSAGE,
    );
  });

  it("エラーの文にキーらしい文字が入っていても、ログには出さない", async () => {
    const err = new Error("Incorrect API key provided: sk-or-v1-abcdef1234567890");

    await generateStrengthDescriptions(STRENGTHS, vi.fn().mockRejectedValue(err));

    const logged = JSON.stringify(mocks.logWarn.mock.calls[0]);
    expect(logged).not.toContain("abcdef1234567890");
    expect(logged).toContain("[REDACTED]");
  });

  it("キーが未設定の場合は、request_failed と、その旨の文を出す", async () => {
    const err = new Error("OPENROUTER_API_KEY が設定されていません");

    await generateStrengthDescriptions(STRENGTHS, vi.fn().mockRejectedValue(err));

    expect(mocks.logWarn).toHaveBeenCalledWith(
      {
        reason: "request_failed",
        errName: "Error",
        errMessage: "OPENROUTER_API_KEY が設定されていません",
      },
      MESSAGE,
    );
  });
});

describe("checkStrengthDescriptions（#72）", () => {
  it("正しい出力は、ok と説明文を返す", () => {
    const result = checkStrengthDescriptions(VALID_OUTPUT, EXPECTED_CODES);

    expect(result.ok).toBe(true);
  });

  it("validateStrengthDescriptions と、同じ判定になる（使えない出力は、どちらでも使えない）", () => {
    const broken = {
      strengths: [
        VALID_OUTPUT.strengths[0],
        VALID_OUTPUT.strengths[1],
        { code: "craft", description: "新しいアイ歩???" },
      ],
    };

    expect(checkStrengthDescriptions(broken, EXPECTED_CODES).ok).toBe(false);
    expect(validateStrengthDescriptions(broken, EXPECTED_CODES)).toBeNull();
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
