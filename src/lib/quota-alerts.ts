import { createServiceClient } from "@/lib/supabase/service";
import { PLAN_LIMITS, type BotPlan } from "@/lib/types";
import { log } from "@/lib/log";

const THRESHOLDS = [
  { key: "80", pct: 0.8, subject: "Ragify: 80% of monthly messages used" },
  { key: "100", pct: 1.0, subject: "Ragify: monthly message limit reached" },
] as const;

async function sendEmail(to: string, subject: string, body: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    log({ level: "warn", msg: "quota_alert_skipped", reason: "RESEND_API_KEY not set" });
    return;
  }

  const from = process.env.RESEND_FROM_EMAIL ?? "Ragify <onboarding@resend.dev>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, text: body }),
  });

  if (!res.ok) {
    const err = await res.text();
    log({ level: "warn", msg: "quota_alert_email_failed", error: err });
  }
}

/**
 * Fire-and-forget quota alert emails at 80% and 100% usage.
 * Called after a successful consume_message_quota.
 */
export async function maybeSendQuotaAlert(
  botId: string,
  plan: string,
  remaining: number
) {
  const botPlan = plan in PLAN_LIMITS ? (plan as BotPlan) : "free";
  const limit = PLAN_LIMITS[botPlan].messages;
  const used = limit - remaining;
  const usagePct = used / limit;

  const supabase = createServiceClient();

  const { data: bot } = await supabase
    .from("bots")
    .select("id, name, owner_id, quota_alert_sent")
    .eq("id", botId)
    .single();

  if (!bot) return;

  const alreadySent = new Set(
    (bot.quota_alert_sent ?? "").split(",").filter(Boolean)
  );

  for (const threshold of THRESHOLDS) {
    if (usagePct < threshold.pct) continue;
    if (alreadySent.has(threshold.key)) continue;

    const { data: owner } = await supabase.auth.admin.getUserById(bot.owner_id);
    const email = owner?.user?.email;
    if (!email) continue;

    await sendEmail(
      email,
      threshold.subject,
      `Your bot "${bot.name}" has used ${Math.round(usagePct * 100)}% of its monthly message quota (${used}/${limit} messages on the ${botPlan} plan).\n\nManage your bot: ${process.env.NEXT_PUBLIC_APP_URL}/dashboard/bots/${botId}`
    );

    alreadySent.add(threshold.key);
    await supabase
      .from("bots")
      .update({ quota_alert_sent: Array.from(alreadySent).join(",") })
      .eq("id", botId);

    log({ msg: "quota_alert_sent", bot_id: botId, threshold: threshold.key });
  }
}
