// Lemon Squeezy webhook — syncs subscription plan to user_profiles + bots
import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";
import { createServiceClient } from "@ragify/core/supabase/service";
import { log, logError } from "@ragify/core/log";

const PLAN_MAP: Record<string, string> = {
  starter: "starter",
  pro: "pro",
  free: "free",
};

function verifySignature(rawBody: string, signature: string | null): boolean {
  const secret = process.env.LEMON_WEBHOOK_SECRET;
  if (!secret || !signature) return false;
  const digest = createHmac("sha256", secret).update(rawBody).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
  } catch {
    return false;
  }
}

function extractPlan(variantName: string | undefined): string {
  if (!variantName) return "free";
  const lower = variantName.toLowerCase();
  if (lower.includes("pro")) return "pro";
  if (lower.includes("starter")) return "starter";
  return "free";
}

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("x-signature");

  if (!verifySignature(rawBody, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let payload: {
    meta?: {
      event_name?: string;
      custom_data?: { user_id?: string };
    };
    data?: {
      id?: string;
      attributes?: {
        status?: string;
        variant_name?: string;
        customer_id?: number;
      };
    };
  };

  try {
    payload = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventName = payload.meta?.event_name ?? "unknown";
  const eventId = String(payload.data?.id ?? `${eventName}-${Date.now()}`);
  const userId = payload.meta?.custom_data?.user_id;

  const supabase = createServiceClient();

  const { data: existing } = await supabase
    .from("processed_webhooks")
    .select("id")
    .eq("event_id", eventId)
    .maybeSingle();

  if (existing) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  await supabase.from("processed_webhooks").insert({
    event_id: eventId,
    event_name: eventName,
    payload: JSON.parse(rawBody),
  });

  if (!userId) {
    log({ level: "warn", msg: "lemon_webhook_no_user", event_name: eventName });
    return NextResponse.json({ ok: true, skipped: true });
  }

  const status = payload.data?.attributes?.status;
  const variantName = payload.data?.attributes?.variant_name;
  const customerId = payload.data?.attributes?.customer_id;

  let plan = "free";
  if (
    eventName.includes("subscription_created") ||
    eventName.includes("subscription_updated")
  ) {
    if (status === "active" || status === "on_trial") {
      plan = extractPlan(variantName);
    }
  }

  if (eventName.includes("subscription_cancelled") || eventName.includes("subscription_expired")) {
    plan = "free";
  }

  const mappedPlan = PLAN_MAP[plan] ?? "free";

  await supabase.from("user_profiles").upsert({
    user_id: userId,
    plan: mappedPlan,
    lemon_customer_id: customerId ? String(customerId) : undefined,
    lemon_subscription_id: eventId,
    updated_at: new Date().toISOString(),
  });

  await supabase.from("bots").update({ plan: mappedPlan }).eq("owner_id", userId);

  log({ msg: "lemon_webhook_processed", event_name: eventName, user_id: userId, plan: mappedPlan });

  return NextResponse.json({ ok: true, plan: mappedPlan });
}
