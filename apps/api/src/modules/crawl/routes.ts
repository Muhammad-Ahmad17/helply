import { z } from "zod";
import type { Context } from "hono";
import {
  assertCrawlEnv,
  ensureSource,
  processSourceCrawl,
  processUrlBatch,
} from "@ragify/core/crawl-worker";
import {
  createCrawlJob,
  getBotForOwner,
} from "@ragify/core/db";
import { enqueueCrawlJob } from "@ragify/core/queue";
import { assertSafeUrl, UnsafeUrlError, discoverFromSitemap } from "@ragify/core/crawler";
import { crawlLimiter, checkRateLimit } from "@ragify/core/rate-limit";
import { getClientIp } from "@ragify/core/security";
import { log, logError } from "@ragify/core/log";

const bodySchema = z.object({
  botId: z.string().uuid(),
  sourceId: z.string().uuid().optional(),
  url: z.string().url().optional(),
  crawlSite: z.boolean().optional(),
});

const SITE_CRAWL_INLINE_LIMIT = 50;

export async function crawlPost(c: Context) {
  const user = c.get("user");

  try {
    const envError = assertCrawlEnv();
    if (envError) return c.json({ error: envError }, 500);

    const json = await c.req.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success || (!parsed.data.sourceId && !parsed.data.url)) {
      return c.json({ error: "Provide botId plus either sourceId or url." }, 400);
    }

    const { botId, sourceId, url, crawlSite } = parsed.data;

    let rate;
    try {
      rate = await checkRateLimit(crawlLimiter, user.id);
    } catch {
      rate = { success: true, limit: 999, remaining: 999, reset: Date.now() + 60_000 };
    }
    if (!rate.success) {
      return c.json({ error: "Crawl rate limit exceeded. Try again later." }, 429);
    }

    const bot = await getBotForOwner(botId, user.id);
    if (!bot) return c.json({ error: "Bot not found" }, 404);

    const plan = bot.plan ?? "free";

    if (crawlSite && url) {
      try {
        await assertSafeUrl(url);
      } catch (err) {
        const message =
          err instanceof UnsafeUrlError ? err.message : "Unsafe URL blocked";
        return c.json({ error: message }, 400);
      }

      const discovered = await discoverFromSitemap(url, plan);
      if (discovered.length === 0) {
        return c.json(
          { error: "No URLs found in sitemap. Use the single Crawl button instead." },
          400
        );
      }

      const inline = discovered.slice(0, SITE_CRAWL_INLINE_LIMIT);
      const overflow = discovered.slice(SITE_CRAWL_INLINE_LIMIT);

      let processed = 0;
      const errors: string[] = [];

      for (const pageUrl of inline) {
        const ensured = await ensureSource(botId, pageUrl);
        if ("error" in ensured) {
          errors.push(`${pageUrl}: ${ensured.error}`);
          continue;
        }
        const result = await processSourceCrawl(botId, ensured.id, pageUrl);
        if (result.ok) processed++;
        else errors.push(`${pageUrl}: ${result.error ?? "failed"}`);
      }

      const jobIds: string[] = [];
      for (const pageUrl of overflow) {
        const ensured = await ensureSource(botId, pageUrl);
        if ("error" in ensured) continue;
        const job = await createCrawlJob(botId, pageUrl, ensured.id);
        await enqueueCrawlJob({
          jobId: job.id,
          botId,
          sourceId: ensured.id,
          url: pageUrl,
        });
        jobIds.push(job.id);
      }

      log({
        msg: "site_crawl_batch",
        bot_id: botId,
        discovered: discovered.length,
        processed,
        queued: jobIds.length,
      });

      if (processed === 0 && jobIds.length === 0) {
        return c.json({ error: errors[0] ?? "All crawls failed" }, 500);
      }

      return c.json({
        ok: true,
        processed,
        queued: jobIds.length,
        discovered: discovered.length,
        message:
          jobIds.length > 0
            ? `Crawled ${processed} pages now. ${jobIds.length} more queued for the background worker.`
            : `Crawled ${processed} pages.`,
        errors: errors.length > 0 ? errors : undefined,
      });
    }

    let sid = sourceId;
    let targetUrl = url;

    if (targetUrl) {
      try {
        await assertSafeUrl(targetUrl);
      } catch (err) {
        const message =
          err instanceof UnsafeUrlError ? err.message : "Unsafe URL blocked";
        return c.json({ error: message }, 400);
      }
    }

    if (sid && targetUrl) {
      /* both provided */
    } else if (sid) {
      const { getSql } = await import("@ragify/core/db");
      const sql = getSql();
      const [existing] = await sql<{ url: string }[]>`
        select url from sources where id = ${sid} limit 1
      `;
      if (!existing) return c.json({ error: "Source not found" }, 404);
      targetUrl = existing.url;
    } else if (targetUrl) {
      const ensured = await ensureSource(botId, targetUrl);
      if ("error" in ensured) return c.json({ error: ensured.error }, 500);
      sid = ensured.id;
    }

    if (!sid || !targetUrl) return c.json({ error: "Bad state" }, 500);

    log({
      msg: "crawl_started",
      bot_id: botId,
      source_id: sid,
      ip: getClientIp(c.req.raw),
    });

    const result = await processSourceCrawl(botId, sid, targetUrl);
    if (!result.ok) return c.json({ error: result.error ?? "Crawl failed" }, 500);

    return c.json({
      ok: true,
      chunks: result.chunks,
      title: result.title,
      sourceId: sid,
      message: `Indexed ${result.chunks} chunks from ${result.title ?? targetUrl}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logError("crawl_unhandled", err);
    return c.json({ error: message }, 500);
  }
}
