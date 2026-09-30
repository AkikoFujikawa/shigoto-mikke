import { Router } from "express";
import { param } from "express-validator";
import { getJob } from "../controllers/jobs.controller.js";
import { requireStudent } from "../middlewares/requireStudent.js";
import { handleValidationErrors } from "../middlewares/validate.js";

// API設計 §3.6。jobId が整数でない場合は、ほかのAPIの入力検証と同じく 400 にする
export const jobsRouter = Router();

jobsRouter.get(
  "/jobs/:jobId",
  requireStudent,
  param("jobId").isInt({ min: 1 }).withMessage("職業を確認してください").toInt(),
  handleValidationErrors,
  getJob,
);
