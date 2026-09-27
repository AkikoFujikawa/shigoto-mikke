const mocks = vi.hoisted(() => ({
  findStudent: vi.fn(),
  findInterests: vi.fn(),
  findQuestions: vi.fn(),
}));

vi.mock("../src/lib/prisma.js", () => ({
  prisma: {
    student: { findUnique: mocks.findStudent },
    interest: { findMany: mocks.findInterests },
    question: { findMany: mocks.findQuestions },
  },
}));

vi.mock("../src/lib/redis.js", () => ({
  redis: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue("OK"),
  },
}));

import jwt from "jsonwebtoken";
import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app.js";

const SECRET = "test-session-secret";

function makeStudentToken(studentId: number, schoolId: number): string {
  return jwt.sign({ schoolId, role: "student" }, SECRET, {
    algorithm: "HS256",
    subject: String(studentId),
  });
}

describe("GET /v1/masters/interests", () => {
  beforeEach(() => {
    vi.stubEnv("SESSION_SECRET", SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("トークンが無い場合は、401 UNAUTHORIZED を返す", async () => {
    const res = await request(createApp()).get("/v1/masters/interests");

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: { code: "UNAUTHORIZED", message: "もう一度はじめからお試しください" },
    });
  });

  it("正しいトークンで、200と好きなもの一覧を返す", async () => {
    mocks.findStudent.mockResolvedValue({ id: 101, schoolId: 7 });
    mocks.findInterests.mockResolvedValue([
      { id: 1, code: "talk", label: "人と話す", emoji: "💬" },
    ]);
    const token = makeStudentToken(101, 7);

    const res = await request(createApp())
      .get("/v1/masters/interests")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ 
      items: [{ id: 1, code: "talk", label: "人と話す", emoji: "💬" }] 
    });
  });
});

describe("GET /v1/masters/questions", () => {
  beforeEach(() => {
    vi.stubEnv("SESSION_SECRET", SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it("トークンが無い場合は、401 UNAUTHORIZED を返す", async () => {
    const res = await request(createApp()).get("/v1/masters/questions");

    expect(res.status).toBe(401);
    expect(res.body).toEqual({
      error: { code: "UNAUTHORIZED", message: "もう一度はじめからお試しください" },
    });
  });

  it("正しいトークンで、200と質問一覧を返す（traitIdは含まれない）", async () => {
    mocks.findStudent.mockResolvedValue({ id: 101, schoolId: 7 });
    mocks.findQuestions.mockResolvedValue([
      {
        id: 1,
        text: "気になることを見つけたら？",
        options: [
          { id: 11, label: "まず調べて詳しく知りたい", emoji: null },
          { id: 12, label: "まず自分なりのアイデアを考えてみたい", emoji: null },
        ],
      },
    ]);
    const token = makeStudentToken(101, 7);

    const res = await request(createApp())
      .get("/v1/masters/questions")
      .set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      items: [
        {
          id: 1,
          options: [
            { id: 11, emoji: null, label: "まず調べて詳しく知りたい" },
            { id: 12, emoji: null, label: "まず自分なりのアイデアを考えてみたい" },
          ],
          text: "気になることを見つけたら？",
        },
      ],
    });
  });
});
