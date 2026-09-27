import cors from "cors";
import express, { type Express } from "express";
import helmet from "helmet";
import { pinoHttp } from "pino-http";
import { env } from "./config/env.js";
import { logger } from "./config/logger.js";
import { handleUnexpectedError } from "./middlewares/errorHandler.js";
import { healthRouter } from "./routes/health.routes.js";
import { studentsRouter } from "./routes/students.routes.js";
import { mastersRouter } from "./routes/masters.routes.js";

export function createApp(): Express {
  const app = express();

  app.use(helmet());
  // CORS は FRONTEND_URL のみ許可（API設計 §1・§6）
  app.use(cors({ origin: env.frontendUrl }));
  app.use(express.json());
  app.use(pinoHttp({ logger }));

  app.use("/v1", healthRouter);
  app.use("/v1", studentsRouter);
  app.use("/v1", mastersRouter);

  app.use(handleUnexpectedError);

  return app;
}
