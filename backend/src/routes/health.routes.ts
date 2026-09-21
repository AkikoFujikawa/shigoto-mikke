import { Router } from "express";
import { getHealth } from "../controllers/health.controller.js";

// API設計 §2: GET /v1/health は認証不要
export const healthRouter = Router();
healthRouter.get("/health", getHealth);
