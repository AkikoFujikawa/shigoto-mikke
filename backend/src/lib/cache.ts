import { logger } from "../config/logger.js";
import { redis } from "./redis.js";

/**
 * Redis キャッシュの取得・保存の共通処理（#103）。
 * Redis が使えなくてもアプリは止めない（API設計 §5）：取得に失敗したら null、保存に失敗したら何もしない。
 * 失敗は、ほかのログと同じ pino で出す（#72）。キーには個人情報を入れない（master:* と ai:strengths:* のみ）。
 */
export async function getCached<T = unknown>(key: string): Promise<T | null> {
  try {
    const value = await redis.get(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch (err) {
    logger.warn({ err, key }, "Redis からキャッシュを取得できませんでした");
    return null;
  }
}

export async function setCached(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch (err) {
    logger.warn({ err, key }, "Redis にキャッシュを保存できませんでした");
  }
}
