import { createHash } from "node:crypto";
import { getCached, setCached } from "./cache.js";
import {
  AI_MODEL,
  buildMessages,
  generateStrengthDescriptions,
  validateStrengthDescriptions,
  type StrengthForAi,
} from "./strengthAi.js";

// AI の強みの説明のキャッシュ（#70）。
// AI に渡すのは強み3つ（code・特性名・説明）だけなので、同じ3つなら、検証を通った文を使い回す。
// 生徒の入力（好きなもの＋回答）ではなく AI に送る内容で見分けるので、強みが同じ生徒どうしで再利用できる。

/** 保存する時間（DB設計 §8） */
export const STRENGTH_CACHE_TTL_SECONDS = 24 * 60 * 60;

/** Redis に保存する形。Map はそのまま JSON にできないので、AI の出力と同じ形（配列）で持つ */
type CachedStrengths = {
  model: string;
  strengths: { code: string; description: string }[];
};

export type StrengthDescriptions = {
  descriptions: Map<string, string>;
  model: string;
  /** 保存済みの文を使ったか（AI を呼ばなかったか） */
  fromCache: boolean;
};

/**
 * キャッシュのキー。AI に送る内容（モデル・プロンプト・強み3つ）そのものから作る。
 * プロンプトや traits.description を変えるとキーも変わるので、古い文が使われ続けることはない。
 */
export function strengthCacheKey(strengths: StrengthForAi[]): string {
  const input = JSON.stringify({ model: AI_MODEL, messages: buildMessages(strengths) });
  return `ai:strengths:${createHash("sha256").update(input).digest("hex")}`;
}

/**
 * 強み3つの説明文を返す。保存済みの文があれば AI を呼ばずに使い、無ければ AI で作って保存する。
 * AI の失敗（null）は保存しない（保存すると、失効するまで固定文になり続けるため）。
 * Redis が使えないときは、取得も保存もできないだけで、これまでどおり AI を呼ぶ（lib/cache.ts）。
 */
export async function describeStrengths(
  strengths: StrengthForAi[],
  generate: typeof generateStrengthDescriptions = generateStrengthDescriptions,
): Promise<StrengthDescriptions | null> {
  const key = strengthCacheKey(strengths);
  const codes = strengths.map((s) => s.code);

  const cached = await getCached<CachedStrengths>(key);
  if (cached) {
    // 保存したあとで検証のルールが増えても、今のルールを通った文だけを使う
    const descriptions = validateStrengthDescriptions(cached, codes);
    if (descriptions && typeof cached.model === "string") {
      return { descriptions, model: cached.model, fromCache: true };
    }
  }

  const ai = await generate(strengths);
  if (!ai) return null;

  const value: CachedStrengths = {
    model: ai.model,
    strengths: [...ai.descriptions].map(([code, description]) => ({ code, description })),
  };
  await setCached(key, value, STRENGTH_CACHE_TTL_SECONDS);
  return { ...ai, fromCache: false };
}
