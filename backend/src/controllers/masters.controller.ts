import type { NextFunction, Request, Response } from "express";
import { prisma } from "../lib/prisma.js";
import { redis } from "../lib/redis.js";

const CACHE_TTL_SECONDS = 60 * 60;
const INTERESTS_CACHE_KEY = "masters:interests";

export async function getInterests(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const cached = await getCached(INTERESTS_CACHE_KEY);
    if (cached) {
      res.set("Cache-Control", `public, max-age=${CACHE_TTL_SECONDS}`);
      res.status(200).json(cached);
      return;
    }

    const interests = await prisma.interest.findMany({
      select: { id: true, code: true, label: true, emoji: true },
      orderBy: { sortOrder: "asc" },
    });

    await setCached(INTERESTS_CACHE_KEY, interests);

    res.set("Cache-Control", `public, max-age=${CACHE_TTL_SECONDS}`);
    res.status(200).json(interests);
  } catch (err) {
    next(err);
  }
}

async function getCached(key: string): Promise<unknown | null> {
  try {
    const value = await redis.get(key);
    return value ? JSON.parse(value) : null;
  } catch (err) {
    console.error(`[redis] get failed for ${key}:`, err);
    return null;
  }
}

async function setCached(key: string, value: unknown): Promise<void> {
  try {
    await redis.set(key, JSON.stringify(value), "EX", CACHE_TTL_SECONDS);
  } catch (err) {
    console.error(`[redis] set failed for ${key}:`, err);
  }
}

const QUESTIONS_CACHE_KEY = "masters:questions";

export async function getQuestions(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const cached = await getCached(QUESTIONS_CACHE_KEY);
    if (cached) {
      res.set("Cache-Control", `public, max-age=${CACHE_TTL_SECONDS}`);
      res.status(200).json(cached);
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

    await setCached(QUESTIONS_CACHE_KEY, questions);

    res.set("Cache-Control", `public, max-age=${CACHE_TTL_SECONDS}`);
    res.status(200).json(questions);
  } catch (err) {
    next(err);
  }
}
