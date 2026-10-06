import type { NextFunction, Request, Response } from "express";
import { redis } from "../lib/redis.js";

type RateLimitOptions = {
  /** Redis のキーの頭（DB設計 §8。例：rl:diag） */
  prefix: string;
  /** 期間内に許す回数 */
  limit: number;
  /** 期間（秒） */
  windowSeconds: number;
  /** 誰の回数として数えるか（生徒ID・IP など）。null なら数えない */
  identify: (req: Request) => string | null;
};

/** 429 RATE_LIMITED と、あと何秒でリセットされるか（Retry-After）を返す */
async function sendRateLimited(res: Response, key: string, windowSeconds: number): Promise<void> {
  const ttl = await redis.ttl(key);
  res.set("Retry-After", String(ttl > 0 ? ttl : windowSeconds));
  res.status(429).json({
    error: { code: "RATE_LIMITED", message: "しばらくしてからもう一度お試しください" },
  });
}

/**
 * Redis のカウンタでレート制限する（#69）。
 * 期間内の回数が limit を超えたら 429 RATE_LIMITED を返す（API設計 §4・§5）。
 * Redis が使えないときは制限せずに通す（API設計 §5「レート制限のみ無効化される点は許容」）。
 */
export function rateLimit({ prefix, limit, windowSeconds, identify }: RateLimitOptions) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const id = identify(req);
    if (!id) {
      next();
      return;
    }

    const key = `${prefix}:${id}`;
    try {
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, windowSeconds);

      if (count > limit) {
        await sendRateLimited(res, key, windowSeconds);
        return;
      }
    } catch (err) {
      req.log?.warn({ err }, "レート制限を確認できなかったため、制限せずに続けます");
    }
    next();
  };
}

/**
 * 失敗したときだけ数えるレート制限（#69）。
 * 学校コードの総当たり対策で使う。正しく入れた生徒は数えないので、
 * 同じ IP からの一斉アクセス（学校）は止めない（API設計 §5）。
 */
export function failureRateLimit({
  prefix,
  limit,
  windowSeconds,
  identify,
  isFailure,
}: RateLimitOptions & { isFailure: (statusCode: number) => boolean }) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const id = identify(req);
    if (!id) {
      next();
      return;
    }

    const key = `${prefix}:${id}`;
    try {
      // ① 今までの失敗回数が上限に達していたら、止める
      const count = Number((await redis.get(key)) ?? 0);
      if (count >= limit) {
        await sendRateLimited(res, key, windowSeconds);
        return;
      }
    } catch (err) {
      req.log?.warn({ err }, "レート制限を確認できなかったため、制限せずに続けます");
      next();
      return;
    }

    // ② 返事を送り終わったあと、失敗だったら回数を1増やす
    res.on("finish", () => {
      if (!isFailure(res.statusCode)) return;
      void (async () => {
        try {
          const failures = await redis.incr(key);
          if (failures === 1) await redis.expire(key, windowSeconds);
        } catch (err) {
          req.log?.warn({ err }, "失敗回数を記録できませんでした");
        }
      })();
    });
    next();
  };
}
