import { Router } from "express";
import { body } from "express-validator";
import { createStudentSession } from "../controllers/students.controller.js";
import { handleValidationErrors } from "../middlewares/validate.js";
import { failureRateLimit } from "../middlewares/rateLimit.js";

// API設計 §3.1: POST /v1/students/session は認証不要

export const studentsRouter = Router();

// 学校コードの総当たり対策。学校コードを間違えた（404）ときだけ、IP ごとに数える
// （学校は同じ IP からの一斉アクセスが普通なので、正しく入れた生徒は数えない。API設計 §5・DB設計 §8 rl:register:{ip}）
const SESSION_FAILURE_LIMIT = 10;
const SESSION_FAILURE_WINDOW_SECONDS = 10 * 60;

const sessionFailureLimit = failureRateLimit({
  prefix: "rl:register",
  limit: SESSION_FAILURE_LIMIT,
  windowSeconds: SESSION_FAILURE_WINDOW_SECONDS,
  identify: (req) => req.ip ?? null,
  isFailure: (statusCode) => statusCode === 404,
});

studentsRouter.post(
  "/students/session",
  sessionFailureLimit,
  body("schoolCode")
    .isString()
    .withMessage("学校コードを入力してください")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("学校コードを入力してください")
    .bail()
    .isAlphanumeric("en-US")
    .withMessage("学校コードは英数字で入力してください")
    .bail()
    .isLength({ max: 20 })
    .withMessage("学校コードは20文字以内で入力してください")
    .bail()
    .toUpperCase(),
  body("nickname")
    .isString()
    .withMessage("ニックネームを入力してください")
    .bail()
    .trim()
    .notEmpty()
    .withMessage("ニックネームを入力してください")
    .bail()
    .isLength({ max: 20 })
    .withMessage("20文字以内で入力してください"),
  handleValidationErrors,
  createStudentSession,
);
