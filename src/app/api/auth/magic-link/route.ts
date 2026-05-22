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
    return NextResponse.json(
      { error: "Too many login attempts. Try again in 15 minutes." },
      { status: 429 }
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${getAppUrl()}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) {
    log({ level: "warn", msg: "magic_link_failed", error: error.message });
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  log({ msg: "magic_link_sent", email: email.replace(/(.{2}).*(@.*)/, "$1***$2") });
  return NextResponse.json({ ok: true });
}
