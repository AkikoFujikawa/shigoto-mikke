import { Redis } from "ioredis";

import { env } from "../config/env.js";

/**
 * Redis クライアントのシングルトン。
 * DB設計.md §8 の通り、マスタ系キャッシュ用途が必須。TTL切れ／Redis停止でも
 * アプリが動くこと（DB／AIへフォールバック）が前提のため、接続エラーで
 * プロセスを落とさない設定にしている。
 */
export const redis = new Redis(env.redisUrl, {
  maxRetriesPerRequest: 2,
  lazyConnect: true,
});

redis.on("error", (err: Error) => {
  console.error("[redis] connection error:", err.message);
});
