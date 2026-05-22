// Background worker: claims pending crawl_jobs and processes them.
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { crawlUrl } from "@/lib/crawler";
import { chunkText } from "@/lib/ai/chunk";
import { embedPassages } from "@/lib/ai/embeddings";
import { log, logError } from "@/lib/log";
import type { CrawlJob } from "@/lib/types";

export const maxDuration = 300;

const MAX_ATTEMPTS = 2;

function verifyCronAuth(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

async function processJob(job: {
  id: string;
  bot_id: string;
  source_id: string | null;
  url: string;
  attempts: number;
}) {
  const service = createServiceClient();
  let sid = job.source_id;

  try {
    if (!sid) {
      const { data: existing } = await service
        .from("sources")
        .select("id")
        .eq("bot_id", job.bot_id)
        .eq("url", job.url)
        .maybeSingle();

      if (existing) {
        sid = existing.id;
      } else {
        const { data: inserted, error } = await service
          .from("sources")
          .insert({ bot_id: job.bot_id, url: job.url, status: "pending" })
          .select("id")
          .single();
        if (error || !inserted) throw new Error(error?.message ?? "Failed to create source");
        sid = inserted.id;
      }
    }

    await service.from("sources").update({ status: "crawling" }).eq("id", sid);

    const result = await crawlUrl(job.url);
    const chunks = chunkText(result.text);

    if (chunks.length === 0) {
      throw new Error("No text content found on page.");
    }

    await service.from("chunks").delete().eq("source_id", sid);

    const embeddings = await embedPassages(chunks.map((c) => c.content));

    const rows = chunks.map((c, i) => ({
      bot_id: job.bot_id,
      source_id: sid,
      content: c.content,
      embedding: embeddings[i],
      token_count: c.tokenCount,
    }));

    for (let i = 0; i < rows.length; i += 50) {
      const slice = rows.slice(i, i + 50);
      const { error: insertError } = await service.from("chunks").insert(slice);
      if (insertError) throw new Error(insertError.message);
    }

    await service
      .from("sources")
      .update({
        status: "ready",
        title: result.title,
        last_crawled_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", sid);

    await service
      .from("crawl_jobs")
      .update({ status: "done", finished_at: new Date().toISOString(), last_error: null })
      .eq("id", job.id);

    log({ msg: "crawl_job_done", bot_id: job.bot_id, url: job.url, chunks: chunks.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logError("crawl_job_failed", err, { bot_id: job.bot_id, url: job.url });

    if (sid) {
      await service
        .from("sources")
        .update({ status: "error", error_message: message })
        .eq("id", sid);
    }

    if (job.attempts < MAX_ATTEMPTS) {
      await service
        .from("crawl_jobs")
        .update({ status: "pending", last_error: message, started_at: null })
        .eq("id", job.id);
    } else {
      await service
        .from("crawl_jobs")
        .update({
          status: "error",
          last_error: message,
          finished_at: new Date().toISOString(),
        })
        .eq("id", job.id);
    }
  }
}

export async function GET(req: Request) {
  if (!verifyCronAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const service = createServiceClient();
  const { data: jobs, error } = await service.rpc("claim_crawl_jobs", { p_limit: 5 });

  if (error) {
    logError("claim_crawl_jobs_failed", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const claimed = (jobs ?? []) as CrawlJob[];
  await Promise.all(claimed.map((job) => processJob(job)));

  return NextResponse.json({ processed: claimed.length });
}
