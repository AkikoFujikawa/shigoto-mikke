const mocks = vi.hoisted(() => ({
  redisGet: vi.fn(),
  redisSet: vi.fn(),
  logWarn: vi.fn(),
}));

vi.mock("../src/lib/redis.js", () => ({
  redis: { get: mocks.redisGet, set: mocks.redisSet },
}));

// 失敗のログが、ほかと同じ pino（logger）で出ることを確かめる（#72）
vi.mock("../src/config/logger.js", () => ({
  logger: { info: vi.fn(), warn: mocks.logWarn, error: vi.fn() },
}));

import { afterEach, describe, expect, it, vi } from "vitest";
import { getCached, setCached } from "../src/lib/cache.js";

describe("getCached", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("キャッシュがある場合は、JSON から元の値に戻して返す", async () => {
    mocks.redisGet.mockResolvedValue(JSON.stringify({ id: 7, name: "宇宙開発技術者" }));

    const value = await getCached("master:job:7");

    expect(value).toEqual({ id: 7, name: "宇宙開発技術者" });
    expect(mocks.redisGet).toHaveBeenCalledWith("master:job:7");
  });

  it("キャッシュが無い場合は、null を返す", async () => {
    mocks.redisGet.mockResolvedValue(null);

    const value = await getCached("master:job:7");

    expect(value).toBeNull();
    expect(mocks.redisGet).toHaveBeenCalledWith("master:job:7");
  });

  it("Redis が失敗した場合は、例外を投げずに null を返し、キーつきでログに残す", async () => {
    const err = new Error("Redis down");
    mocks.redisGet.mockRejectedValue(err);

    const value = await getCached("master:job:7");

    expect(value).toBeNull();
    expect(mocks.redisGet).toHaveBeenCalledWith("master:job:7");
    expect(mocks.logWarn).toHaveBeenCalledWith(
      { err, key: "master:job:7" },
      "Redis からキャッシュを取得できませんでした",
    );
  });

  it("成功した場合は、ログを出さない", async () => {
    mocks.redisGet.mockResolvedValue(null);

    await getCached("master:job:7");

    expect(mocks.logWarn).not.toHaveBeenCalled();
  });
});

describe("setCached", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("JSON にして、指定した有効期限で保存する", async () => {
    mocks.redisSet.mockResolvedValue("OK");

    await setCached("master:job:7", { id: 7 }, 3600);

    expect(mocks.redisSet).toHaveBeenCalledWith("master:job:7", '{"id":7}', "EX", 3600);
  });

  it("Redis が失敗した場合は、例外を投げずに終わり、キーつきでログに残す", async () => {
    const err = new Error("Redis down");
    mocks.redisSet.mockRejectedValue(err);

    await expect(setCached("master:job:7", { id: 7 }, 3600)).resolves.toBeUndefined();

    expect(mocks.redisSet).toHaveBeenCalled();
    expect(mocks.logWarn).toHaveBeenCalledWith(
      { err, key: "master:job:7" },
      "Redis にキャッシュを保存できませんでした",
    );
  });
});
