import { PLAN_LIMITS, type BotPlan } from "./types.js";

export interface QuotaAlertResult {
  botId: string;
  botName: string;
  ownerEmail: string | null;
  plan: BotPlan;
  used: number;
  limit: number;
  threshold: "80" | "100";
}

export function quotaThresholds(
  used: number,
  limit: number,
  alreadySent: string
): ("80" | "100")[] {
  const pct = limit > 0 ? (used / limit) * 100 : 0;
  const out: ("80" | "100")[] = [];
  if (pct >= 80 && !alreadySent.includes("80")) out.push("80");
  if (pct >= 100 && !alreadySent.includes("100")) out.push("100");
  return out;
}

export function nextAlertSent(alreadySent: string, threshold: "80" | "100"): string {
  const parts = new Set(alreadySent.split(",").filter(Boolean));
  parts.add(threshold);
  return [...parts].sort().join(",");
}

export function planMessageLimit(plan: BotPlan): number {
  return PLAN_LIMITS[plan]?.messages ?? PLAN_LIMITS.free.messages;
}

export async function sendQuotaEmail(opts: {
  to: string;
  botName: string;
  threshold: "80" | "100";
  used: number;
  limit: number;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL ?? "Ragify <notifications@ragify.tech>";
  if (!apiKey) return false;

  const subject =
    opts.threshold === "100"
      ? `[Ragify] ${opts.botName} hit its monthly message limit`
      : `[Ragify] ${opts.botName} is at 80% of its message quota`;

  const body =
    opts.threshold === "100"
      ? `Your bot "${opts.botName}" has used ${opts.used.toLocaleString()} of ${opts.limit.toLocaleString()} messages this month. Chat will be blocked until next month or you upgrade your plan.`
      : `Your bot "${opts.botName}" has used ${opts.used.toLocaleString()} of ${opts.limit.toLocaleString()} messages this month (80%+). Consider upgrading before you hit the limit.`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [opts.to],
      subject,
      text: `${body}\n\nManage your bots: https://ragify.tech/dashboard`,
    }),
  });

  return res.ok;
}
