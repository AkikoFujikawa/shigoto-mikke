import request from "supertest";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findSchool: vi.fn(),
  get: vi.fn(),
  incr: vi.fn(),
  expire: vi.fn(),
  ttl: vi.fn(),
}));

vi.mock("../src/lib/prisma.js", () => ({
  prisma: { school: { findUnique: mocks.findSchool } },
}));

// レート制限は本物を使い、Redis だけ差しかえる。どの IP のキーで数えたかを見る
vi.mock("../src/lib/redis.js", () => ({
  redis: { get: mocks.get, incr: mocks.incr, expire: mocks.expire, ttl: mocks.ttl },
}));

import { createApp } from "../src/app.js";

// 学校コードをまちがえたときに、IP ごとに数えるレート制限（rl:register）のキーを見る
async function sendWrongSchoolCode(forwardedFor?: string) {
  const req = request(createApp()).post("/v1/students/session");
  if (forwardedFor) req.set("X-Forwarded-For", forwardedFor);
  return req.send({ schoolCode: "NOTFOUND", nickname: "みさき" });
}

describe("trust proxy（Render の中継役の後ろで、生徒の IP を読む。#77）", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("本番と同じ3段の中継役を通ったときは、生徒の IP で数える", async () => {
    mocks.findSchool.mockResolvedValue(null);
    mocks.get.mockResolvedValue(null);

    // 生徒 → Cloudflare → Render の中 → アプリの直前の中継役（＝テストでは supertest の接続元）
    const res = await sendWrongSchoolCode("198.51.100.7, 104.23.160.5, 10.24.39.123");

    expect(res.status).toBe(404);
    expect(mocks.get).toHaveBeenCalledWith("rl:register:198.51.100.7");
  });

  it("生徒が X-Forwarded-For にいつわりの IP を書いても、だまされずに生徒の IP で数える", async () => {
    mocks.findSchool.mockResolvedValue(null);
    mocks.get.mockResolvedValue(null);

    // Render は、生徒が付けた値を消さずに、その後ろへ足していく
    const res = await sendWrongSchoolCode("203.0.113.9, 198.51.100.7, 104.23.160.5, 10.24.39.123");

    expect(res.status).toBe(404);
    expect(mocks.get).toHaveBeenCalledWith("rl:register:198.51.100.7");
    expect(mocks.get).not.toHaveBeenCalledWith("rl:register:203.0.113.9");
  });

  it("中継役がない（手元の開発）ときは、直接つないできた相手の IP で数える", async () => {
    mocks.findSchool.mockResolvedValue(null);
    mocks.get.mockResolvedValue(null);

    const res = await sendWrongSchoolCode();

    expect(res.status).toBe(404);
    expect(mocks.get).toHaveBeenCalledWith(
      expect.stringMatching(/^rl:register:(::ffff:)?127\.0\.0\.1$/),
    );
  });
});
