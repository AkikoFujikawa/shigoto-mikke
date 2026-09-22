/**
 * backend/scripts/verify-db-redis.ts
 *
 * Issue #21 の受け入れ条件「Redis接続を確認」用の手動確認スクリプト。
 * 既存の /v1/health（PR #23 でレビュー済み）の契約は変えず、独立したスクリプトとして用意。
 *
 * 実行方法：
 *   docker compose exec backend pnpm tsx scripts/verify-db-redis.ts
 */

import { prisma } from "../src/lib/prisma.js";
import { redis } from "../src/lib/redis.js";

async function main() {
  console.log("[verify] DB (Prisma) 接続確認…");
  const schoolCount = await prisma.school.count();
  console.log(
    `[verify] OK: schools テーブルに ${schoolCount} 件（0件でも接続成功の確認としては問題なし）`,
  );

  console.log("[verify] Redis 接続確認…");
  const pong = await redis.ping();
  console.log(`[verify] OK: PING -> ${pong}`);
}

main()
  .catch((err) => {
    console.error("[verify] 失敗:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    redis.disconnect();
  });
