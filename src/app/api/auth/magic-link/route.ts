// POST /api/auth/magic-link — rate-limited magic link sender
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { loginLimiter, checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/security";
import { getAppUrl } from "@/lib/utils";
import { log } from "@/lib/log";

const bodySchema = z.object({
  email: z.string().email(),
  next: z.string().optional(),
});

function isSupabaseRateLimit(message: string): boolean {
  const lower = message.toLowerCase();
  return (
    lower.includes("rate limit") ||
    lower.includes("too many requests") ||
    lower.includes("once every") ||
    lower.includes("security purposes")
  );
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email" }, { status: 400 });
  }

  const { email, next = "/dashboard" } = parsed.data;
  const ip = getClientIp(req);
  const rateKey = `${email.toLowerCase()}:${ip}`;

  const rate = await checkRateLimit(loginLimiter, rateKey);
  if (!rate.success) {
    const waitMin = Math.max(1, Math.ceil((rate.reset - Date.now()) / 60_000));
    return NextResponse.json(
      {
        error: `Too many login attempts for this email. Wait ${waitMin} minute(s) and try again.`,
        source: "helply",
      },
      {
        status: 429,
        headers: { "Retry-After": String(Math.ceil((rate.reset - Date.now()) / 1000)) },
      }
    );
  }

  const appUrl = getAppUrl(req);
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${appUrl}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    log({ level: "warn", msg: "magic_link_failed", error: error.message });

    if (isSupabaseRateLimit(error.message)) {
      return NextResponse.json(
        {
          error:
            "Supabase email limit reached. Wait 60 seconds before trying again (applies to all emails from your network on the free tier).",
          source: "supabase",
        },
        { status: 429 }
      );
    }

    return NextResponse.json({ error: error.message, source: "supabase" }, { status: 400 });
  }

  log({ msg: "magic_link_sent", email: email.replace(/(.{2}).*(@.*)/, "$1***$2") });
  return NextResponse.json({ ok: true });
}
