const mocks = vi.hoisted(() => ({
  incr: vi.fn(),
  expire: vi.fn(),
  ttl: vi.fn(),
  get: vi.fn(),
}));

vi.mock("../src/lib/redis.js", () => ({
  redis: { incr: mocks.incr, expire: mocks.expire, ttl: mocks.ttl, get: mocks.get },
}));

import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { failureRateLimit, rateLimit } from "../src/middlewares/rateLimit.js";

// テスト用の小さなアプリ。10分に3回まで通す制限をつける
function createTestApp(identify: () => string | null = () => "student-1") {
  const app = express();
  app.get(
    "/limited",
    rateLimit({ prefix: "rl:test", limit: 3, windowSeconds: 600, identify }),
    (_req, res) => {
      res.status(200).json({ ok: true });
    },
  );
  return app;
}

describe("rateLimit", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("1回目は通し、回数を数えて、10分で消えるタイマーをセットする", async () => {
    // Redis で数えたら「1回目」だった、という状況
    mocks.incr.mockResolvedValue(1);

    const res = await request(createTestApp()).get("/limited");

    expect(res.status).toBe(200);
    expect(mocks.incr).toHaveBeenCalledWith("rl:test:student-1");
    expect(mocks.expire).toHaveBeenCalledWith("rl:test:student-1", 600);
  });

  it("2回目は通すが、タイマーはセットし直さない", async () => {
    mocks.incr.mockResolvedValue(2);

    const res = await request(createTestApp()).get("/limited");

    expect(res.status).toBe(200);
    expect(mocks.incr).toHaveBeenCalledWith("rl:test:student-1");
    expect(mocks.expire).not.toHaveBeenCalled();
  });

  it("上限ちょうど（3回目）は、まだ通す", async () => {
    mocks.incr.mockResolvedValue(3);

    const res = await request(createTestApp()).get("/limited");

    expect(res.status).toBe(200);
  });

  it("上限を超えた（4回目）は、429 RATE_LIMITED と Retry-After を返す", async () => {
    mocks.incr.mockResolvedValue(4);
    // Redis に聞いたら「あと120秒でリセット」だった、という状況
    mocks.ttl.mockResolvedValue(120);

    const res = await request(createTestApp()).get("/limited");

    expect(res.status).toBe(429);
    expect(res.body).toEqual({
      error: { code: "RATE_LIMITED", message: "しばらくしてからもう一度お試しください" },
    });
    expect(res.headers["retry-after"]).toBe("120");
  });

  it("誰か分からない（identify が null）ときは、数えずに通す", async () => {
    const res = await request(createTestApp(() => null)).get("/limited");

    expect(res.status).toBe(200);
    expect(mocks.incr).not.toHaveBeenCalled();
  });

  it("Redis が使えないときは、制限せずに通す", async () => {
    mocks.incr.mockRejectedValue(new Error("Redis down"));

    const res = await request(createTestApp()).get("/limited");

    expect(res.status).toBe(200);
  });
});

// 返事を送り終わったあとの処理（res.on("finish")）が終わるのを、少しだけ待つ
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

// テスト用の小さなアプリ。指定したステータスを返す。404 のときだけ数えて、10分に3回まで
function createFailureTestApp(status: number) {
  const app = express();
  app.get(
    "/session",
    failureRateLimit({
      prefix: "rl:test-fail",
      limit: 3,
      windowSeconds: 600,
      identify: () => "1.2.3.4",
      isFailure: (statusCode) => statusCode === 404,
    }),
    (_req, res) => {
      res.status(status).json({});
    },
  );
  return app;
}

describe("failureRateLimit", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("失敗（404）のときは、回数を1増やして、10分のタイマーをセットする", async () => {
    // 今までの失敗は0回（キーが無い）、1増やしたら1回目、という状況
    mocks.get.mockResolvedValue(null);
    mocks.incr.mockResolvedValue(1);

    const res = await request(createFailureTestApp(404)).get("/session");
    await flush();

    expect(res.status).toBe(404);
    expect(mocks.incr).toHaveBeenCalledWith("rl:test-fail:1.2.3.4");
    expect(mocks.expire).toHaveBeenCalledWith("rl:test-fail:1.2.3.4", 600);
  });

  // TODO ⑥ 成功（201）のときは、回数を数えない
  it("成功（201）のときは、回数を数えない", async () => {
    mocks.get.mockResolvedValue(null);

    const res = await request(createFailureTestApp(201)).get("/session");
    await flush();

    expect(res.status).toBe(201);
    expect(mocks.incr).not.toHaveBeenCalled();
  });
  // TODO ⑦ 失敗が上限（3回）に達していたら、429 を返す
  it("失敗が上限（3回）に達していたら、429 RATE_LIMITED を返す", async () => {
    // 今までの失敗が3回、という状況（Redis は文字列で返す）
    mocks.get.mockResolvedValue("3");
    mocks.ttl.mockResolvedValue(300);

    const res = await request(createFailureTestApp(201)).get("/session");

    expect(res.status).toBe(429);
    expect(res.headers["retry-after"]).toBe("300");
  });
  // TODO ⑧ Redis が使えないときは、制限せずに通す
  it("Redis が使えないときは、制限せずに通す", async () => {
    mocks.get.mockRejectedValue(new Error("Redis down"));

    const res = await request(createFailureTestApp(201)).get("/session");

    expect(res.status).toBe(201);
  });
});
