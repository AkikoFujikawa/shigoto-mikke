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

  app.use(helmet());
  // CORS は FRONTEND_URL のみ許可（API設計 §1・§6）
  app.use(cors({ origin: env.frontendUrl }));
  // Stripe の Webhook は生のボディで署名を検証するため、express.json() より前に登録する（API設計 §3.7）
  app.use("/v1", billingWebhookRouter);
  app.use(express.json());
  app.use(pinoHttp({ logger }));

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
