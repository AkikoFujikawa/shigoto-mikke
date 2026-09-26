import { Router } from "express";
import { requireStudent } from "../middlewares/requireStudent.js";
import { getInterests, getQuestions } from "../controllers/masters.controller.js";

export const mastersRouter = Router();

mastersRouter.get("/masters/interests", requireStudent, getInterests);
mastersRouter.get("/masters/questions", requireStudent, getQuestions);
