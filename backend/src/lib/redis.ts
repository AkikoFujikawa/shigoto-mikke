import { Redis } from "ioredis";

import { env } from "../config/env.js";

/**
 * Redis クライアントのシングルトン。
 * DB設計.md §8 の通り、マスタ系キャッシュ用途が必須。TTL切れ／Redis停止でも
 * アプリが動くこと（DB／AIへフォールバック）が前提のため、接続エラーで
 * プロセスを落とさない設定にしている。
 */
/**
 * 1つの命令を待つ上限（ミリ秒）。#122
 * Redis につながらないとき、何も指定しないと1つの命令に約12秒かかり、API が10秒以上待たされる。
 * 上限を過ぎたら失敗として扱い、呼び出し側（lib/cache.ts・middlewares/rateLimit.ts）が
 * DB へのフォールバックや「制限せずに通す」に進めるようにする。
 */
export const REDIS_COMMAND_TIMEOUT_MS = 1000;

export const redis = new Redis(env.redisUrl, {
  maxRetriesPerRequest: 2,
  lazyConnect: true,
  commandTimeout: REDIS_COMMAND_TIMEOUT_MS,
});

redis.on("error", (err: Error) => {
  console.error("[redis] connection error:", err.message);
});
