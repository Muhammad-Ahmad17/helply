import type { Context } from "hono";
import { getSql } from "@ragify/core/db";
import { verifyCronAuth } from "@ragify/core/crawl-worker";
import { checkEmbedHealth } from "@ragify/core/ai/embeddings";
import {
  nextAlertSent,
  planMessageLimit,
  quotaThresholds,
  sendQuotaEmail,
} from "@ragify/core/quota-alerts";
import { log, logError } from "@ragify/core/log";

export async function crawlWorkerGet(c: Context) {
  if (!verifyCronAuth(c.req.raw)) return c.json({ error: "Unauthorized" }, 401);
  return c.json({
    ok: true,
    message: "Crawl processing handled by BullMQ worker on OCI",
  });
}

async function checkPostgres(): Promise<boolean> {
  try {
    const sql = getSql();
    await sql`select 1`;
    return true;
  } catch {
    return false;
  }
}

async function checkGroq(): Promise<boolean> {
  if (!process.env.GROQ_API_KEY) return false;
  const res = await fetch("https://api.groq.com/openai/v1/models", {
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
  });
  return res.ok;
}

async function checkRedis(): Promise<boolean> {
  const url = process.env.REDIS_URL;
  if (!url) return true;
  const IORedisMod = (await import("ioredis")).default;
  const client = new (IORedisMod as unknown as new (url: string, opts?: object) => {
    connect: () => Promise<void>;
    ping: () => Promise<string>;
    disconnect: () => void;
  })(url, { maxRetriesPerRequest: 1, connectTimeout: 3000, lazyConnect: true });
  try {
    await client.connect();
    return (await client.ping()) === "PONG";
  } catch {
    return false;
  } finally {
    client.disconnect();
  }
}

export async function healthCheckGet(c: Context) {
  if (!verifyCronAuth(c.req.raw)) return c.json({ error: "Unauthorized" }, 401);

  const [postgresOk, groqOk, embedOk, redisOk] = await Promise.all([
    checkPostgres(),
    checkGroq(),
    checkEmbedHealth(),
    checkRedis(),
  ]);

  const healthy = postgresOk && groqOk && embedOk && redisOk;
  const report = {
    postgres: postgresOk,
    groq: groqOk,
    embed: embedOk,
    redis: redisOk,
    healthy,
  };

  if (!healthy) logError("health_check_failed", new Error("unhealthy"), report);
  else log({ msg: "health_check_ok", ...report });

  return c.json(report, healthy ? 200 : 503);
}

export async function exportConversationsGet(c: Context) {
  if (!verifyCronAuth(c.req.raw)) return c.json({ error: "Unauthorized" }, 401);

  const sql = getSql();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const conversations = await sql`
    select c.id, c.bot_id, c.visitor_id, c.ip_hash, c.created_at,
      coalesce(
        json_agg(
          json_build_object('id', m.id, 'role', m.role, 'content', m.content, 'created_at', m.created_at)
          order by m.created_at
        ) filter (where m.id is not null),
        '[]'::json
      ) as messages
    from conversations c
    left join messages m on m.conversation_id = c.id
    where c.created_at >= ${since}
    group by c.id
    order by c.created_at desc
    limit 5000
  `;

  return c.json({
    ok: true,
    exported_at: new Date().toISOString(),
    count: conversations.length,
    conversations,
  });
}

export async function quotaAlertsGet(c: Context) {
  if (!verifyCronAuth(c.req.raw)) return c.json({ error: "Unauthorized" }, 401);

  const sql = getSql();
  const bots = await sql<
    Array<{
      id: string;
      name: string;
      owner_id: string;
      plan: string;
      monthly_message_count: number;
      quota_alert_sent: string;
    }>
  >`select id, name, owner_id, plan, monthly_message_count, quota_alert_sent from bots`;

  let sent = 0;
  for (const bot of bots) {
    const plan = (bot.plan ?? "free") as "free" | "starter" | "pro";
    const limit = planMessageLimit(plan);
    const used = bot.monthly_message_count ?? 0;
    let already = bot.quota_alert_sent ?? "";
    const thresholds = quotaThresholds(used, limit, already);
    if (thresholds.length === 0) continue;

    const [owner] = await sql<{ email: string | null }[]>`
      select email from users where id = ${bot.owner_id} limit 1
    `;
    const email = owner?.email;
    if (!email) continue;

    for (const threshold of thresholds) {
      const ok = await sendQuotaEmail({
        to: email,
        botName: bot.name,
        threshold,
        used,
        limit,
      });
      if (ok) {
        already = nextAlertSent(already, threshold);
        await sql`update bots set quota_alert_sent = ${already} where id = ${bot.id}`;
        sent++;
      }
    }
  }

  return c.json({ ok: true, alertsSent: sent });
}
