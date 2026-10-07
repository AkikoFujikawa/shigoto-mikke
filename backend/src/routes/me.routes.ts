import { Router } from "express";
import { getMe } from "../controllers/me.controller.js";
import { requireStudentOrAdmin } from "../middlewares/requireStudentOrAdmin.js";

// API設計 §3.3: GET /v1/me は生徒・管理者のどちらも呼べる（未登録のFirebase UIDは 403）
export const meRouter = Router();
meRouter.get("/me", requireStudentOrAdmin, getMe);
