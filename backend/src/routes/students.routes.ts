import { Router } from "express";
import { body } from "express-validator";
import { createStudentSession } from "../controllers/students.controller.js";
import { handleValidationErrors } from "../middlewares/validate.js";

// API設計 §3.1: POST /v1/students/session は認証不要
export const studentsRouter = Router();

studentsRouter.post(
  "/students/session",
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
