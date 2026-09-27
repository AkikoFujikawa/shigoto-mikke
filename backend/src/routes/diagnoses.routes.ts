import { Router } from "express";
import { body } from "express-validator";
import { createDiagnosis } from "../controllers/diagnoses.controller.js";
import { requireStudent } from "../middlewares/requireStudent.js";
import { handleValidationErrors } from "../middlewares/validate.js";

// API設計 §3.5。形のチェック（個数・整数・重複）はここで行い、
// DBを見るチェック（存在するID・その質問の選択肢か）はコントローラーで行う
export const diagnosesRouter = Router();

const hasNoDuplicates = (values: unknown[]) => new Set(values).size === values.length;

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
