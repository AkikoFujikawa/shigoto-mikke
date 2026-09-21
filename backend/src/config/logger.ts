import pino from "pino";
import { env, isProduction } from "./env.js";

/**
 * NODE_ENV での出力切替（README §6）。
 * development: debug 以上・整形出力（pino-pretty）
 * production : info 以上・JSON
 * Authorization ヘッダーやパスワードはマスクする。
 */
export const logger = pino({
  level: isProduction ? "info" : "debug",
  transport: isProduction
    ? undefined
    : {
        target: "pino-pretty",
        options: { colorize: true, translateTime: "HH:MM:ss" },
      },
  redact: {
    paths: [
      "req.headers.authorization",
      "req.body.password",
      "req.body.token",
    ],
    censor: "[REDACTED]",
  },
});

void env; // env を将来使う拡張のための明示的な参照（未使用警告の抑制はしない方針だが、現状は不要なら削除してよい）
