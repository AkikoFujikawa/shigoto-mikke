import OpenAI from "openai";
import { logger } from "../config/logger.js";
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

/** 説明文の最小文字数。プロンプトでは30〜45文字を頼んでいるが、少し短い文は通す。極端に短いものは壊れた出力とみなす（#137） */
export const DESCRIPTION_MIN_LENGTH = 15;

/** 壊れた出力の印（#137）。「?」「？」が2つ以上続く、文字化け（U+FFFD） */
export const BROKEN_PATTERNS: RegExp[] = [/[?？]{2,}/, /\uFFFD/];

export type StrengthForAi = {
  code: string;
  label: string;
  description: string;
};

/**
 * AI の出力を使えなかった理由（#72）。ログに出して、どこを直せばよいかを数えられるようにする。
 * 説明文そのものが理由のときは、どの強みの、どんな文だったかも持つ（生徒の情報は含まれない）。
 */
export type StrengthRejection = {
  reason:
    | "invalid_shape" // 形がちがう（強みの数・code がちがう、など）
    | "too_short"
    | "too_long"
    | "forbidden_word" // 断定・進路の決めつけ・URL（FORBIDDEN_PATTERNS）
    | "broken_text" // 「?」の連続・文字化け（BROKEN_PATTERNS）
    | "no_period"; // 「。」で終わらない（途中で切れた文）
  code?: string;
  description?: string;
};

export type StrengthCheckResult =
  { ok: true; descriptions: Map<string, string> } | { ok: false; rejection: StrengthRejection };

/** AI の出力をチェックし、強みの code ごとの説明文か、使えなかった理由を返す */
export function checkStrengthDescriptions(
  output: unknown,
  expectedCodes: string[],
): StrengthCheckResult {
  const invalidShape: StrengthCheckResult = { ok: false, rejection: { reason: "invalid_shape" } };
  if (typeof output !== "object" || output === null) return invalidShape;
  const strengths = (output as { strengths?: unknown }).strengths;
  if (!Array.isArray(strengths) || strengths.length !== expectedCodes.length) return invalidShape;

  const result = new Map<string, string>();
  for (const item of strengths) {
    if (typeof item !== "object" || item === null) return invalidShape;
    const { code, description } = item as { code?: unknown; description?: unknown };
    if (typeof code !== "string" || typeof description !== "string") return invalidShape;
    if (!expectedCodes.includes(code) || result.has(code)) return invalidShape;

    const text = description.trim();
    const reject = (reason: StrengthRejection["reason"]): StrengthCheckResult => ({
      ok: false,
      rejection: { reason, code, description: text },
    });
    if (text.length < DESCRIPTION_MIN_LENGTH) return reject("too_short");
    if (text.length > DESCRIPTION_MAX_LENGTH) return reject("too_long");
    if (FORBIDDEN_PATTERNS.some((pattern) => pattern.test(text))) return reject("forbidden_word");
    if (BROKEN_PATTERNS.some((pattern) => pattern.test(text))) return reject("broken_text");
    // 途中で切れた文を弾く（#137）。語尾の言葉（「かも」など）は見ない
    if (!text.endsWith("。")) return reject("no_period");

    result.set(code, text);
  }
  return { ok: true, descriptions: result };
}

/**
 * AI の出力をチェックし、強みの code ごとの説明文を返す。
 * 1つでも条件を満たさなければ null（呼び出し側で固定文にフォールバックする）。
 */
export function validateStrengthDescriptions(
  output: unknown,
  expectedCodes: string[],
): Map<string, string> | null {
  const result = checkStrengthDescriptions(output, expectedCodes);
  return result.ok ? result.descriptions : null;
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
    "- 渡された強みそれぞれについて、高校生に伝わるやさしい言葉で、30〜45文字の説明を1文で書く",
    "- 「根気」「姿勢」「傾向」「完成度」のような、かたい熟語は使わない",
    "- 「〜って」のような、くだけすぎた話し言葉も使わず、教科書のようにやさしく自然な文にする",
    "- 文末は「〜ところがありそう。」か「〜かも。」のどちらかにそろえる（「かもしれない」「かもしれません」は使わない）",
    "- 渡された説明（description）をそのまま書き写さず、自分の言葉で言い換える",
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

const AI_UNUSABLE_MESSAGE = "AI の強みの説明を使えませんでした";
const LOG_TEXT_MAX_LENGTH = 200;

/** ログに出す文字を短くし、キーらしい文字（sk-…）を伏せる。エラーの文にキーの一部が入ることがあるため */
function toLogText(value: unknown): string {
  return String(value)
    .replace(/sk-[A-Za-z0-9_-]{6,}/g, "[REDACTED]")
    .slice(0, LOG_TEXT_MAX_LENGTH);
}

/** AI の呼び出しそのものが失敗した理由。エラーをまるごと出さず、種類・文・HTTP の状態だけを出す */
function describeRequestError(err: unknown) {
  const name = err instanceof Error ? err.name : typeof err;
  const message = err instanceof Error ? err.message : err;
  const status = (err as { status?: unknown } | null)?.status;
  return {
    reason: /timed? ?out/i.test(`${name} ${String(message)}`) ? "timeout" : "request_failed",
    errName: name,
    errMessage: toLogText(message),
    ...(typeof status === "number" ? { status } : {}),
  };
}

/**
 * 強み3つの説明文を AI で作る。
 * 失敗・タイムアウト・出力が不正なときは null を返す（呼び出し側で固定文にフォールバックする。案A）。
 * null にした理由は、ログに出す（#72）。reason で数えれば、どの理由が多いかが分かる。
 */
export async function generateStrengthDescriptions(
  strengths: StrengthForAi[],
  request: AiRequester = requestOpenRouter,
): Promise<{ descriptions: Map<string, string>; model: string } | null> {
  let content: string | null;
  try {
    content = await request(strengths);
  } catch (err) {
    logger.warn(describeRequestError(err), AI_UNUSABLE_MESSAGE);
    return null;
  }
  if (!content) {
    logger.warn({ reason: "empty_response" }, AI_UNUSABLE_MESSAGE);
    return null;
  }

  let output: unknown;
  try {
    output = JSON.parse(content);
  } catch {
    logger.warn({ reason: "invalid_json", content: toLogText(content) }, AI_UNUSABLE_MESSAGE);
    return null;
  }

  const result = checkStrengthDescriptions(
    output,
    strengths.map((s) => s.code),
  );
  if (!result.ok) {
    const { reason, code, description } = result.rejection;
    logger.warn(
      {
        reason,
        ...(code ? { code } : {}),
        ...(description !== undefined ? { description: toLogText(description) } : {}),
      },
      AI_UNUSABLE_MESSAGE,
    );
    return null;
  }
  return { descriptions: result.descriptions, model: AI_MODEL };
}
