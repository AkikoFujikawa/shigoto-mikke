import pino from "pino";
import { isProduction } from "./env.js";

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
    paths: ["req.headers.authorization", "req.body.password", "req.body.token"],
    censor: "[REDACTED]",
  },
});
