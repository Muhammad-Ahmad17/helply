import { createServiceClient } from "@/lib/supabase/service";
import { crawlUrl } from "@/lib/crawler";
import { chunkText } from "@/lib/ai/chunk";
import { embedPassages } from "@/lib/ai/embeddings";
import { log, logError } from "@/lib/log";
import type { CrawlJob } from "@/lib/types";

export const MAX_CRAWL_ATTEMPTS = 2;

/** Cap chunks per page so crawls finish within Vercel Hobby's ~10s limit. */
export const MAX_CHUNKS_PER_CRAWL = 15;

export interface CrawlJobInput {
  id: string;
  bot_id: string;
  source_id: string | null;
  url: string;
  attempts: number;
}

export interface CrawlJobResult {
  ok: boolean;
  chunks?: number;
  title?: string;
  error?: string;
}

export function verifyCronAuth(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export function assertCrawlEnv(): string | null {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return "SUPABASE_SERVICE_ROLE_KEY is not set on the server.";
  }
  if (!process.env.JINA_API_KEY) {
    return "JINA_API_KEY is not set on the server.";
  }
  return null;
}

/** Get or create a source row for a URL. */
export async function ensureSource(
  botId: string,
  url: string
): Promise<{ id: string } | { error: string }> {
  const service = createServiceClient();

  const { data: existing } = await service
    .from("sources")
    .select("id")
    .eq("bot_id", botId)
    .eq("url", url)
    .maybeSingle();

  if (existing) return { id: existing.id };

  const { data: inserted, error } = await service
    .from("sources")
    .insert({ bot_id: botId, url, status: "pending" })
    .select("id")
    .single();

  if (error || !inserted) {
    return { error: error?.message ?? "Failed to create source" };
  }
  return { id: inserted.id };
}

/**
 * Crawl a single source directly — no crawl_jobs table required.
 */
export async function processSourceCrawl(
  botId: string,
  sourceId: string,
  url: string
): Promise<CrawlJobResult> {
  const envError = assertCrawlEnv();
  if (envError) return { ok: false, error: envError };

  const service = createServiceClient();

  try {
    await service.from("sources").update({ status: "crawling" }).eq("id", sourceId);

    const result = await crawlUrl(url);
    const allChunks = chunkText(result.text);
    const chunks = allChunks.slice(0, MAX_CHUNKS_PER_CRAWL);

    if (chunks.length === 0) {
      throw new Error("No text content found on page.");
    }

    await service.from("chunks").delete().eq("source_id", sourceId);

    const embeddings = await embedPassages(chunks.map((c) => c.content));

    const rows = chunks.map((c, i) => ({
      bot_id: botId,
      source_id: sourceId,
      content: c.content,
      embedding: embeddings[i],
      token_count: c.tokenCount,
    }));

    for (let i = 0; i < rows.length; i += 50) {
      const slice = rows.slice(i, i + 50);
      const { error: insertError } = await service.from("chunks").insert(slice);
      if (insertError) throw new Error(insertError.message);
    }

    const truncated = allChunks.length > chunks.length;

    await service
      .from("sources")
      .update({
        status: "ready",
        title: result.title,
        last_crawled_at: new Date().toISOString(),
        error_message: truncated
          ? `Indexed first ${chunks.length} of ${allChunks.length} chunks (plan limit).`
          : null,
      })
      .eq("id", sourceId);

    log({ msg: "source_crawl_done", bot_id: botId, url, chunks: chunks.length });

    return { ok: true, chunks: chunks.length, title: result.title };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logError("source_crawl_failed", err, { bot_id: botId, url });

    await service
      .from("sources")
      .update({ status: "error", error_message: message })
      .eq("id", sourceId);

    return { ok: false, error: message };
  }
}

/** Process one crawl job end-to-end (requires crawl_jobs table). */
export async function processCrawlJob(job: CrawlJobInput): Promise<CrawlJobResult> {
  let sid = job.source_id;

  try {
    if (!sid) {
      const ensured = await ensureSource(job.bot_id, job.url);
      if ("error" in ensured) throw new Error(ensured.error);
      sid = ensured.id;
    }

    if (!sid) throw new Error("Source ID missing");

    const result = await processSourceCrawl(job.bot_id, sid, job.url);
    if (!result.ok) throw new Error(result.error ?? "Crawl failed");

    const service = createServiceClient();
    await service
      .from("crawl_jobs")
      .update({ status: "done", finished_at: new Date().toISOString(), last_error: null })
      .eq("id", job.id);

    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logError("crawl_job_failed", err, { bot_id: job.bot_id, url: job.url });

    if (sid) {
      const service = createServiceClient();
      await service
        .from("sources")
        .update({ status: "error", error_message: message })
        .eq("id", sid);
    }

    try {
      const service = createServiceClient();
      if (job.attempts < MAX_CRAWL_ATTEMPTS) {
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
    } catch {
      // crawl_jobs table may not exist
    }

    return { ok: false, error: message };
  }
}

/** Claim and process pending jobs (daily cron). */
export async function claimAndProcessJobs(limit = 5): Promise<number> {
  const service = createServiceClient();
  const { data: jobs, error } = await service.rpc("claim_crawl_jobs", { p_limit: limit });

  if (error) {
    logError("claim_crawl_jobs_failed", error);
    throw new Error(error.message);
  }

  const claimed = (jobs ?? []) as CrawlJob[];
  await Promise.all(claimed.map((job) => processCrawlJob(job)));
  return claimed.length;
}

/** Crawl multiple URLs inline without crawl_jobs (Hobby-friendly). */
export async function processUrlBatch(
  botId: string,
  urls: string[]
): Promise<{ processed: number; errors: string[] }> {
  let processed = 0;
  const errors: string[] = [];

  for (const pageUrl of urls) {
    const ensured = await ensureSource(botId, pageUrl);
    if ("error" in ensured) {
      errors.push(`${pageUrl}: ${ensured.error}`);
      continue;
    }
    const result = await processSourceCrawl(botId, ensured.id, pageUrl);
    if (result.ok) {
      processed++;
    } else {
      errors.push(`${pageUrl}: ${result.error ?? "failed"}`);
    }
  }

  return { processed, errors };
}
