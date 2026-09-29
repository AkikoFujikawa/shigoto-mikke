import { Router } from "express";
import { body } from "express-validator";
import {
  createDiagnosis,
  getLatestDiagnosis,
  getLatestDiagnosisJobs,
} from "../controllers/diagnoses.controller.js";
import { requireStudent } from "../middlewares/requireStudent.js";
import { handleValidationErrors } from "../middlewares/validate.js";

// API設計 §3.5。形のチェック（個数・整数・重複）はここで行い、
// DBを見るチェック（存在するID・その質問の選択肢か）はコントローラーで行う
export const diagnosesRouter = Router();

// 数字の 1 と文字列の "1" を同じものとして比べるため、数値にそろえてから重複を確かめる
// （toInt() はこのチェックの後に行われるため）
const hasNoDuplicates = (values: unknown[]) =>
  new Set(values.map((value) => Number(value))).size === values.length;

diagnosesRouter.post(
  "/diagnoses",
  requireStudent,
  body("interestIds")
    .isArray({ min: 1, max: 3 })
    .withMessage("1〜3個選んでください")
    .bail()
    .custom(hasNoDuplicates)
    .withMessage("同じものは1回だけ選んでください"),
  body("interestIds.*").isInt({ min: 1 }).withMessage("選択内容を確認してください").toInt(),
  body("answers")
    .isArray({ min: 5, max: 5 })
    .withMessage("5問すべてに回答してください")
    .bail()
    .custom((answers: { questionId?: unknown }[]) =>
      hasNoDuplicates(answers.map((a) => a?.questionId)),
    )
    .withMessage("同じ質問に2回回答することはできません"),
  body("answers.*.questionId").isInt({ min: 1 }).withMessage("回答を確認してください").toInt(),
  body("answers.*.optionId").isInt({ min: 1 }).withMessage("回答を確認してください").toInt(),
  handleValidationErrors,
  createDiagnosis,
);

// 入力（body・params・query）が無いため、express-validator のルールは不要（masters.routes.ts と同じ）
diagnosesRouter.get("/diagnoses/latest", requireStudent, getLatestDiagnosis);
diagnosesRouter.get("/diagnoses/latest/jobs", requireStudent, getLatestDiagnosisJobs);
