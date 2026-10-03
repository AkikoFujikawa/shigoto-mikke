import OpenAI from "openai";
// AI 連携（強みの説明のみ）。#65
// AI に送るのは強みの特性名と traits.description のみ（個人情報・職業マスタの文章は送らない）

/** 使うモデル（技術選定 §2） */
export const AI_MODEL = "openai/gpt-oss-120b";

/** タイムアウト。再試行はしない（フロントの20秒に収めるため。チームで決定） */
export const AI_TIMEOUT_MS = 15_000;

/** 説明文の最大文字数（DB設計 diagnosis_strengths.description が varchar(200)） */
export const DESCRIPTION_MAX_LENGTH = 200;

/** 出力に含まれていたら不正とみなす表現（断定・進路の決めつけ・URL。技術選定 §4、企画理念） */
export const FORBIDDEN_PATTERNS: RegExp[] = [
  /向いている/,
  /向いています/,
  /べき(?![るれっらろ])/, // 「〜すべき」は禁止。「調べきる」「食べきれない」などは除く
  /理系/,
  /文系/,
  /必ず/,
  /絶対/,
  /https?:\/\//,
];

export type StrengthForAi = {
  code: string;
  label: string;
  description: string;
};

/**
 * AI の出力をチェックし、強みの code ごとの説明文を返す。
 * 1つでも条件を満たさなければ null（呼び出し側で固定文にフォールバックする）。
 */
export function validateStrengthDescriptions(
  output: unknown,
  expectedCodes: string[],
): Map<string, string> | null {
  if (typeof output !== "object" || output === null) return null;
  const strengths = (output as { strengths?: unknown }).strengths;
  if (!Array.isArray(strengths) || strengths.length !== expectedCodes.length) return null;

  const result = new Map<string, string>();
  for (const item of strengths) {
    if (typeof item !== "object" || item === null) return null;
    const { code, description } = item as { code?: unknown; description?: unknown };
    if (typeof code !== "string" || typeof description !== "string") return null;
    if (!expectedCodes.includes(code) || result.has(code)) return null;

    const text = description.trim();
    if (text.length === 0 || text.length > DESCRIPTION_MAX_LENGTH) return null;
    if (FORBIDDEN_PATTERNS.some((pattern) => pattern.test(text))) return null;

    result.set(code, text);
  }
  return result;
}

/** OpenRouter の接続先（openai の SDK の接続先を向け直す。技術選定 §2） */
export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

/**
 * AI に「強みの説明」を頼む係。AI の返事（JSON の文字列）をそのまま返す。
 * テストでは本物の AI を呼ばないよう、偽物の係を渡せるようにしている。
 */
export type AiRequester = (strengths: StrengthForAi[]) => Promise<string | null>;

/** AI に渡すメッセージ。強みの code・特性名・traits.description だけを送る（#65。個人情報・職業の文章は送らない） */
export function buildMessages(strengths: StrengthForAi[]) {
  const system = [
    "あなたは、高校1年生向けの進路探索アプリで、生徒の「強みのタネ」を短い言葉にするアシスタントです。",
    "次のルールを必ず守ってください。",
    "- 渡された強みそれぞれについて、高校生に伝わるやさしい言葉で、40〜80文字の説明を1文で書く",
    "- 文末は「〜がありそう。」「〜かも。」のように、断定しない表現にする",
    "- 「向いている」「〜すべき」「理系」「文系」「必ず」「絶対」など、進路を決めつける言葉は使わない",
    "- URL・職業名・学校名は書かない",
    "- 出力は指定された JSON の形だけにする",
  ].join("\n");

  const user = JSON.stringify({
    strengths: strengths.map(({ code, label, description }) => ({ code, label, description })),
  });

  return [
    { role: "system" as const, content: system },
    { role: "user" as const, content: user },
  ];
}

/** Structured Outputs で使う、出力の形（JSON スキーマ） */
function buildResponseSchema(codes: string[]) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["strengths"],
    properties: {
      strengths: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["code", "description"],
          properties: {
            code: { type: "string", enum: codes },
            description: { type: "string" },
          },
        },
      },
    },
  };
}

/** 本物の AI（OpenRouter）に頼む係。15秒でタイムアウトし、再試行はしない（チームで決定） */
export const requestOpenRouter: AiRequester = async (strengths) => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY が設定されていません");

  const client = new OpenAI({
    apiKey,
    baseURL: OPENROUTER_BASE_URL,
    timeout: AI_TIMEOUT_MS,
    maxRetries: 0, // SDK は何もしないと自動で再試行するため、はっきり 0 にする
  });

  const completion = await client.chat.completions.create({
    model: AI_MODEL,
    messages: buildMessages(strengths),
    reasoning_effort: "low", // 短い説明文なので深く考えさせず、タイムアウトしにくくする
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "strength_descriptions",
        strict: true,
        schema: buildResponseSchema(strengths.map((s) => s.code)),
      },
    },
  });

  return completion.choices[0]?.message?.content ?? null;
};

/**
 * 強み3つの説明文を AI で作る。
 * 失敗・タイムアウト・出力が不正なときは null を返す（呼び出し側で固定文にフォールバックする。案A）。
 */
export async function generateStrengthDescriptions(
  strengths: StrengthForAi[],
  request: AiRequester = requestOpenRouter,
): Promise<{ descriptions: Map<string, string>; model: string } | null> {
  try {
    const content = await request(strengths);
    if (!content) return null;

    const descriptions = validateStrengthDescriptions(
      JSON.parse(content),
      strengths.map((s) => s.code),
    );
    return descriptions ? { descriptions, model: AI_MODEL } : null;
  } catch {
    return null;
  }
}
