const mocks = vi.hoisted(() => ({
  incr: vi.fn(),
  expire: vi.fn(),
  ttl: vi.fn(),
}));

vi.mock("../src/lib/redis.js", () => ({
  redis: { incr: mocks.incr, expire: mocks.expire, ttl: mocks.ttl },
}));

import express from "express";
import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";
import { rateLimit } from "../src/middlewares/rateLimit.js";

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
