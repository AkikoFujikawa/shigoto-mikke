import { redis } from "./redis.js";

/**
 * Redis キャッシュの取得・保存の共通処理（#103）。
 * Redis が使えなくてもアプリは止めない（API設計 §5）：取得に失敗したら null、保存に失敗したら何もしない。
 * 失敗時のログを pino にそろえるのは #72 で行う。
 */
export async function getCached<T = unknown>(key: string): Promise<T | null> {
  try {
    const value = await redis.get(key);
    return value ? (JSON.parse(value) as T) : null;
  } catch (err) {
    console.error(`[redis] get failed for ${key}:`, err);
    return null;
  }
}

export async function setCached(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  try {
    await redis.set(key, JSON.stringify(value), "EX", ttlSeconds);
  } catch (err) {
    console.error(`[redis] set failed for ${key}:`, err);
  }
}
