import { z } from "zod";
import type { Context } from "hono";
import { getUserFromBearer } from "@ragify/core/auth";
import { assertSafeUrl, UnsafeUrlError, discoverFromSitemap } from "@ragify/core/crawler";
import {
  assertCrawlEnv,
  ensureSource,
  processSourceCrawl,
  processUrlBatch,
} from "@ragify/core/crawl-worker";
import { createServiceClient } from "@ragify/core/supabase/service";
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
  try {
    const envError = assertCrawlEnv();
    if (envError) {
      return c.json({ error: envError }, 500);
    }

    const user = await getUserFromBearer(c.req.header("authorization"));
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const json = await c.req.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success || (!parsed.data.sourceId && !parsed.data.url)) {
      return c.json(
        { error: "Provide botId plus either sourceId or url." },
        400
      );
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

    const service = createServiceClient();
    const { data: bot, error: botError } = await service
      .from("bots")
      .select("*")
      .eq("id", botId)
      .eq("owner_id", user.id)
      .maybeSingle();

    if (botError) {
      logError("crawl_bot_lookup_failed", botError, { bot_id: botId });
      return c.json({ error: botError.message }, 500);
    }
    if (!bot) return c.json({ error: "Bot not found" }, 404);

    const plan = (bot as { plan?: string }).plan ?? "free";

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

      const batch = discovered.slice(0, SITE_CRAWL_INLINE_LIMIT);
      const { processed, errors } = await processUrlBatch(botId, batch);

      log({
        msg: "site_crawl_batch",
        bot_id: botId,
        discovered: discovered.length,
        processed,
      });

      if (processed === 0) {
        return c.json({ error: errors[0] ?? "All crawls failed" }, 500);
      }

      return c.json({
        ok: true,
        processed,
        discovered: discovered.length,
        message:
          discovered.length > batch.length
            ? `Crawled ${processed} pages now. ${discovered.length - batch.length} more queued for the background worker.`
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

    if (sid) {
      const { data: existing } = await service
        .from("sources")
        .select("id, url")
        .eq("id", sid)
        .single();
      if (!existing) return c.json({ error: "Source not found" }, 404);
      targetUrl = existing.url;
    } else if (targetUrl) {
      const ensured = await ensureSource(botId, targetUrl);
      if ("error" in ensured) {
        return c.json({ error: ensured.error }, 500);
      }
      sid = ensured.id;
    }

    if (!sid || !targetUrl) {
      return c.json({ error: "Bad state" }, 500);
    }

    log({ msg: "crawl_started", bot_id: botId, source_id: sid, ip: getClientIp(c.req.raw) });

    const result = await processSourceCrawl(botId, sid, targetUrl);

    if (!result.ok) {
      return c.json({ error: result.error ?? "Crawl failed" }, 500);
    }

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
