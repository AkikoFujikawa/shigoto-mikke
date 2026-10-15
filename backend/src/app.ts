import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { handleUnexpectedError } from "./middlewares/errorHandler.js";
import { handleNotFound } from "./middlewares/notFound.js";
import { billingRouter, billingWebhookRouter } from "./routes/billing.routes.js";
import { healthRouter } from "./routes/health.routes.js";
import { studentsRouter } from "./routes/students.routes.js";
import { mastersRouter } from "./routes/masters.routes.js";
import { diagnosesRouter } from "./routes/diagnoses.routes.js";
import { jobsRouter } from "./routes/jobs.routes.js";
import { meRouter } from "./routes/me.routes.js";
import { schoolsRouter } from "./routes/schools.routes.js";

export function createApp(): Express {
  const app = express();

  // 本番（Render）では、アクセスが3段の中継役（Cloudflare → Render の中の2段）を通って届く。
  // 後ろから3段だけを信じて、X-Forwarded-For から生徒の IP を読む（#77）。
  // 信じないと全員が中継役の IP に見え、IP ごとのレート制限（rl:register）を全員で分け合ってしまう。
  // 4段以上を信じると、生徒が X-Forwarded-For に書いたいつわりの IP を信じてしまう
  app.set("trust proxy", 3);

  app.use(helmet());
  // CORS は FRONTEND_URL のみ許可（API設計 §1・§6）
  app.use(cors({ origin: env.frontendUrl }));
  // ログは、ボディを読むより前に用意する。あとに置くと、壊れた JSON・大きすぎる JSON・Webhook の
  // リクエストが、ログに1行も残らない（#72）
  app.use(pinoHttp({ logger }));
  // Stripe の Webhook は生のボディで署名を検証するため、express.json() より前に登録する（API設計 §3.7）
  app.use("/v1", billingWebhookRouter);
  app.use(express.json());

  app.use("/v1", healthRouter);
  app.use("/v1", studentsRouter);
  app.use("/v1", mastersRouter);
  app.use("/v1", diagnosesRouter);
  app.use("/v1", jobsRouter);
  app.use("/v1", meRouter);
  app.use("/v1", schoolsRouter);
  app.use("/v1", billingRouter);

  app.use(handleNotFound);
  app.use(handleUnexpectedError);

  return app;
}
