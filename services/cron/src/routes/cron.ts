import type { Context } from "hono";
import { createServiceClient } from "@ragify/core/supabase/service";
import { claimAndProcessJobs, verifyCronAuth } from "@ragify/core/crawl-worker";
import { log, logError } from "@ragify/core/log";

export async function crawlWorkerGet(c: Context) {
  if (!verifyCronAuth(c.req.raw)) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  try {
    const processed = await claimAndProcessJobs(10);
    return c.json({ processed });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message }, 500);
  }
}

async function checkSupabase(): Promise<boolean> {
  const supabase = createServiceClient();
  const { error } = await supabase.from("bots").select("id").limit(1);
  return !error;
}

async function checkGroq(): Promise<boolean> {
  if (!process.env.GROQ_API_KEY) return false;
  const res = await fetch("https://api.groq.com/openai/v1/models", {
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
  });
  return res.ok;
}

async function checkJina(): Promise<boolean> {
  if (!process.env.JINA_API_KEY) return false;
  const res = await fetch("https://api.jina.ai/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.JINA_API_KEY}`,
    },
    body: JSON.stringify({
      model: "jina-embeddings-v3",
      task: "retrieval.query",
      dimensions: 1024,
      input: ["health check"],
    }),
  });
  return res.ok;
}

export async function healthCheckGet(c: Context) {
  if (!verifyCronAuth(c.req.raw)) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const [supabaseOk, groqOk, jinaOk] = await Promise.all([
    checkSupabase(),
    checkGroq(),
    checkJina(),
  ]);

  const healthy = supabaseOk && groqOk && jinaOk;
  const report = { supabase: supabaseOk, groq: groqOk, jina: jinaOk, healthy };

  if (!healthy) {
    logError("health_check_failed", new Error("One or more services unhealthy"), report);
  } else {
    log({ msg: "health_check_ok", ...report });
  }

  return c.json(report, healthy ? 200 : 503);
}

export async function exportConversationsGet(c: Context) {
  if (!verifyCronAuth(c.req.raw)) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const supabase = createServiceClient();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: conversations, error } = await supabase
    .from("conversations")
    .select("id, bot_id, visitor_id, ip_hash, created_at, messages(id, role, content, created_at)")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(5000);

  if (error) {
    logError("export_conversations_failed", error);
    return c.json({ error: error.message }, 500);
  }

  const filename = `backups/conversations-${new Date().toISOString().slice(0, 10)}.json`;
  const body = JSON.stringify({
    exported_at: new Date().toISOString(),
    count: conversations?.length ?? 0,
    conversations,
  }, null, 2);

  const { error: uploadError } = await supabase.storage
    .from("helply-backups")
    .upload(filename, body, { contentType: "application/json", upsert: true });

  if (uploadError) {
    log({ level: "warn", msg: "backup_storage_missing", error: uploadError.message });
    return c.json({
      ok: true,
      warning: "Storage bucket 'helply-backups' not found — create it in Supabase Dashboard",
      count: conversations?.length ?? 0,
    });
  }

  log({ msg: "conversations_exported", count: conversations?.length ?? 0, filename });
  return c.json({ ok: true, filename, count: conversations?.length ?? 0 });
}
