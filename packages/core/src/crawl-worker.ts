import {
  createBot as dbCreateBot,
  deleteBot as dbDeleteBot,
  ensureSource as dbEnsureSource,
  getBotById,
  updateCrawlJob,
  updateSource,
} from "./db/index.js";
import { crawlUrl } from "./crawler.js";
import { fetchViaZyte, shouldUseZyteFallback } from "./zyte/index.js";
import { indexSourceText } from "./content/index.js";
import { log, logError } from "./log.js";
import { assertIndexEnv, type IndexJobResult } from "./source-index.js";

export const MAX_CRAWL_ATTEMPTS = 3;
export { MAX_CHUNKS_PER_CRAWL } from "./source-index.js";

export type CrawlJobResult = IndexJobResult;

export function verifyCronAuth(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export function assertCrawlEnv(): string | null {
  return assertIndexEnv();
}

export async function ensureSource(
  botId: string,
  url: string
): Promise<{ id: string } | { error: string }> {
  try {
    const row = await dbEnsureSource(botId, url);
    return { id: row.id };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}

async function fetchPageContent(url: string) {
  try {
    const result = await crawlUrl(url);
    if (shouldUseZyteFallback(result.text, 200)) {
      log({ level: "warn", msg: "zyte_fallback", url });
      const zyte = await fetchViaZyte(url);
      return { title: zyte.title, text: zyte.text };
    }
    return { title: result.title, text: result.text };
  } catch (err) {
    if (process.env.ZYTE_API_KEY) {
      log({ level: "warn", msg: "direct_crawl_failed_zyte", url, error: String(err) });
      const zyte = await fetchViaZyte(url);
      return { title: zyte.title, text: zyte.text };
    }
    throw err;
  }
}

export async function processSourceCrawl(
  botId: string,
  sourceId: string,
  url: string
): Promise<CrawlJobResult> {
  const envError = assertCrawlEnv();
  if (envError) return { ok: false, error: envError };

  try {
    const page = await fetchPageContent(url);
    const result = await indexSourceText(botId, sourceId, page.text, page.title);
    if (result.ok) {
      log({ msg: "source_crawl_done", bot_id: botId, url, chunks: result.chunks });
    }
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logError("source_crawl_failed", err, { bot_id: botId, url });
    await updateSource(sourceId, { status: "error", error_message: message });
    return { ok: false, error: message };
  }
}

export async function processCrawlJobRecord(
  jobId: string,
  botId: string,
  url: string,
  sourceId?: string | null
): Promise<CrawlJobResult> {
  await updateCrawlJob(jobId, {
    status: "running",
    started_at: new Date().toISOString(),
  });

  let sid = sourceId ?? undefined;
  try {
    if (!sid) {
      const ensured = await ensureSource(botId, url);
      if ("error" in ensured) throw new Error(ensured.error);
      sid = ensured.id;
    }

    const result = await processSourceCrawl(botId, sid, url);
    if (!result.ok) throw new Error(result.error ?? "Crawl failed");

    await updateCrawlJob(jobId, {
      status: "done",
      finished_at: new Date().toISOString(),
      last_error: null,
    });
    return result;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await updateCrawlJob(jobId, {
      status: "error",
      last_error: message,
      finished_at: new Date().toISOString(),
    });
    return { ok: false, error: message };
  }
}

export async function processUrlBatch(
  botId: string,
  urls: string[]
): Promise<{ processed: number; errors: string[]; jobIds: string[] }> {
  const { enqueueCrawlBatch } = await import("./queue/index.js");
  const { createCrawlJob } = await import("./db/index.js");

  const payloads = [];
  const jobIds: string[] = [];

  for (const pageUrl of urls) {
    const ensured = await ensureSource(botId, pageUrl);
    if ("error" in ensured) continue;
    const row = await createCrawlJob(botId, pageUrl, ensured.id);
    jobIds.push(row.id);
    payloads.push({
      jobId: row.id,
      botId,
      sourceId: ensured.id,
      url: pageUrl,
    });
  }

  if (payloads.length > 0) {
    await enqueueCrawlBatch(payloads);
  }

  return { processed: payloads.length, errors: [], jobIds };
}
