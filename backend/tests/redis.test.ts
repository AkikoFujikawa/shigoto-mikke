import { afterAll, describe, expect, it } from "vitest";
import { redis, REDIS_COMMAND_TIMEOUT_MS } from "../src/lib/redis.js";

// lazyConnect のため、ここでは Redis に接続しない（設定の値だけを確かめる）
describe("Redis クライアントの設定", () => {
  afterAll(() => {
    redis.disconnect();
  });

  it("命令を待つ上限が入っている（Redis が止まっても API を長く待たせないため。#122）", () => {
    expect(redis.options.commandTimeout).toBe(REDIS_COMMAND_TIMEOUT_MS);
  });

  it("上限は、画面側のタイムアウト（20秒）より十分に短い", () => {
    expect(REDIS_COMMAND_TIMEOUT_MS).toBeGreaterThan(0);
    expect(REDIS_COMMAND_TIMEOUT_MS).toBeLessThanOrEqual(1000);
  });
});
