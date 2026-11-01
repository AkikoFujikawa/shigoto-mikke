import { PrismaClient } from "@prisma/client";

import { isProduction } from "../config/env.js";

/**
 * PrismaClient のシングルトン。
 * 開発時（tsx watch / next dev 的なホットリロード）で接続数が増え続けないよう、
 * globalThis にキャッシュする定番パターン。
 */
declare global {
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  globalThis.__prisma ??
  new PrismaClient({
    log: isProduction ? ["error", "warn"] : ["error", "warn", "query"],
  });

if (!isProduction) {
  globalThis.__prisma = prisma;
}
