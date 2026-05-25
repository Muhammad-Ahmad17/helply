import { Ratelimit } from "@upstash/ratelimit";
import { Redis as UpstashRedis } from "@upstash/redis";
import Redis from "ioredis";

type RedisBackend = UpstashRedis | Redis;

function createRedisBackend(): RedisBackend | null {
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    return new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      lazyConnect: true,
    });
  }

  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) {
    return new UpstashRedis({ url, token });
  }

  return null;
}

const redis = createRedisBackend();

function makeLimiter(
  prefix: string,
  limit: number,
  window: `${number} s` | `${number} m` | `${number} h`
): Ratelimit | null {
  if (!redis) return null;
  return new Ratelimit({
    redis: redis as unknown as UpstashRedis,
    limiter: Ratelimit.slidingWindow(limit, window),
    prefix: `ragify:${prefix}`,
    analytics: true,
  });
}

export const chatLimiter = makeLimiter("chat", 30, "60 s");
export const crawlLimiter = makeLimiter("crawl", 30, "1 h");
export const loginLimiter = makeLimiter("login", 10, "15 m");

export function isRateLimitDisabled(): boolean {
  return process.env.DISABLE_RATE_LIMIT === "true";
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  reset: number;
}

const noopResult: RateLimitResult = {
  success: true,
  limit: 999,
  remaining: 999,
  reset: Date.now() + 60_000,
};

export async function checkRateLimit(
  limiter: Ratelimit | null,
  key: string
): Promise<RateLimitResult> {
  if (isRateLimitDisabled()) {
    return noopResult;
  }

  if (!limiter) {
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "[rate-limit] Redis not configured — rate limiting disabled"
      );
    }
    return noopResult;
  }

  const result = await limiter.limit(key);
  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  };
}
