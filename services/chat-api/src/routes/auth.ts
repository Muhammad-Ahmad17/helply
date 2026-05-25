import { z } from "zod";
import type { Context } from "hono";
import { loginLimiter, checkRateLimit } from "@ragify/core/rate-limit";
import { getClientIp } from "@ragify/core/security";

const bodySchema = z.object({
  email: z.string().email().max(320),
});

export async function loginCheckPost(c: Context) {
  const json = await c.req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return c.json({ error: "Valid email required" }, 400);
  }

  const ip = getClientIp(c.req.raw);
  const key = `${parsed.data.email.toLowerCase()}:${ip}`;

  let rate;
  try {
    rate = await checkRateLimit(loginLimiter, key);
  } catch {
    return c.json({ ok: true, throttled: false });
  }

  if (!rate.success) {
    const retryAfter = Math.max(1, Math.ceil((rate.reset - Date.now()) / 1000));
    return c.json(
      { error: "Too many magic-link requests. Try again later.", retryAfter },
      429,
      { "Retry-After": String(retryAfter) }
    );
  }

  return c.json({ ok: true, remaining: rate.remaining });
}
