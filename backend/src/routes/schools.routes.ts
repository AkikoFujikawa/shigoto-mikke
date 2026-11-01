import { Router } from "express";
import { getMySchool } from "../controllers/schools.controller.js";
import { requireAdmin } from "../middlewares/requireAdmin.js";

// API設計 §3.7: GET /v1/schools/me は管理者だけが呼べる（未認証・生徒のトークンは 401、未登録のFirebase UIDは 403）
export const schoolsRouter = Router();
schoolsRouter.get("/schools/me", requireAdmin, getMySchool);
