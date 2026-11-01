import "dotenv/config";

/**
 * 環境変数の読み込み。
 * 秘密情報の値そのものはログに出さない（README §6）。
 */
export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  frontendUrl: process.env.FRONTEND_URL ?? "http://localhost:3000",
  redisUrl: process.env.REDIS_URL ?? "redis://localhost:6379",
} as const;

export const isProduction = env.nodeEnv === "production";
