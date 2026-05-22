import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

function createRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const redis = createRedis();

function makeLimiter(
  prefix: string,
  limit: number,
  window: `${number} s` | `${number} m` | `${number} h`
) {
  if (!redis) return null;
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(limit, window),
    prefix: `helply:${prefix}`,
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
      console.warn("[rate-limit] Upstash not configured — rate limiting disabled");
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

export function isRateLimitConfigured(): boolean {
  return redis !== null;
}
