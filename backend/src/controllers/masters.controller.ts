import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { getCached, setCached } from "../lib/cache.js";

const CACHE_TTL_SECONDS = 60 * 60;
const INTERESTS_CACHE_KEY = "master:interests";

export async function getInterests(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const cached = await getCached(INTERESTS_CACHE_KEY);
    if (cached) {
      res.set("Cache-Control", `max-age=${CACHE_TTL_SECONDS}`);
      res.status(200).json({ items: cached });
      return;
    }

    const interests = await prisma.interest.findMany({
      select: { id: true, code: true, label: true, emoji: true },
      orderBy: { sortOrder: "asc" },
    });

    await setCached(INTERESTS_CACHE_KEY, interests, CACHE_TTL_SECONDS);

    res.set("Cache-Control", `max-age=${CACHE_TTL_SECONDS}`);
    res.status(200).json({ items: interests });
  } catch (err) {
    next(err);
  }
}

const QUESTIONS_CACHE_KEY = "master:questions";

export async function getQuestions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const cached = await getCached(QUESTIONS_CACHE_KEY);
    if (cached) {
      res.set("Cache-Control", `max-age=${CACHE_TTL_SECONDS}`);
      res.status(200).json({ items: cached });
      return;
    }

    const questions = await prisma.question.findMany({
      select: {
        id: true,
        text: true,
        options: {
          select: { id: true, label: true, emoji: true },
          orderBy: { sortOrder: "asc" },
        },
      },
      orderBy: { sortOrder: "asc" },
    });

    await setCached(QUESTIONS_CACHE_KEY, questions, CACHE_TTL_SECONDS);

    res.set("Cache-Control", `max-age=${CACHE_TTL_SECONDS}`);
    res.status(200).json({ items: questions });
  } catch (err) {
    next(err);
  }
}
