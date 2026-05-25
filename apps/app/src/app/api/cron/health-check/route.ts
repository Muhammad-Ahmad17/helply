// Health check cron — verifies Supabase, Groq, Jina connectivity
import { NextResponse } from "next/server";
import { createServiceClient } from "@ragify/core/supabase/service";
import { log, logError } from "@ragify/core/log";

import { verifyCronAuth } from "@ragify/core/crawl-worker";

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

export async function GET(req: Request) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

  return NextResponse.json(report, { status: healthy ? 200 : 503 });
}
