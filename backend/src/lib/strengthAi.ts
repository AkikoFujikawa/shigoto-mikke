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
  /べき/,
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
