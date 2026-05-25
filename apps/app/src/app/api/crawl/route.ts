// POST /api/crawl
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { assertSafeUrl, UnsafeUrlError, discoverFromSitemap } from "@ragify/core/crawler";
import {
  assertCrawlEnv,
  ensureSource,
  processSourceCrawl,
  processUrlBatch,
} from "@ragify/core/crawl-worker";
import { crawlLimiter, checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/security";
import { log, logError } from "@ragify/core/log";

export const maxDuration = 60;

const bodySchema = z.object({
  botId: z.string().uuid(),
  sourceId: z.string().uuid().optional(),
  url: z.string().url().optional(),
  crawlSite: z.boolean().optional(),
});

/** Max pages to crawl inline (raised for self-hosted; was 2 on Vercel Hobby). */
const SITE_CRAWL_INLINE_LIMIT = 50;

export async function POST(req: Request) {
  try {
    const envError = assertCrawlEnv();
    if (envError) {
      return NextResponse.json({ error: envError }, { status: 500 });
    }

    const json = await req.json().catch(() => null);
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success || (!parsed.data.sourceId && !parsed.data.url)) {
      return NextResponse.json(
        { error: "Provide botId plus either sourceId or url." },
        { status: 400 }
      );
    }

    const { botId, sourceId, url, crawlSite } = parsed.data;

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let rate;
    try {
      rate = await checkRateLimit(crawlLimiter, user.id);
    } catch {
      rate = { success: true, limit: 999, remaining: 999, reset: Date.now() + 60_000 };
    }
    if (!rate.success) {
      return NextResponse.json(
        { error: "Crawl rate limit exceeded. Try again later." },
        { status: 429 }
      );
    }

    // Select * avoids 500 if optional columns (plan) migration not applied yet
    const { data: bot, error: botError } = await supabase
      .from("bots")
      .select("*")
      .eq("id", botId)
      .maybeSingle();

    if (botError) {
      logError("crawl_bot_lookup_failed", botError, { bot_id: botId });
      return NextResponse.json({ error: botError.message }, { status: 500 });
    }
    if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 });

    const plan = (bot as { plan?: string }).plan ?? "free";

    // --- Site-wide crawl (sitemap): no crawl_jobs table needed ---
    if (crawlSite && url) {
      try {
        await assertSafeUrl(url);
      } catch (err) {
        const message =
          err instanceof UnsafeUrlError ? err.message : "Unsafe URL blocked";
        return NextResponse.json({ error: message }, { status: 400 });
      }

      const discovered = await discoverFromSitemap(url, plan);
      if (discovered.length === 0) {
        return NextResponse.json(
          { error: "No URLs found in sitemap. Use the single Crawl button instead." },
          { status: 400 }
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
        return NextResponse.json(
          { error: errors[0] ?? "All crawls failed" },
          { status: 500 }
        );
      }

      return NextResponse.json({
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

    // --- Single URL crawl ---
    let sid = sourceId;
    let targetUrl = url;

    if (targetUrl) {
      try {
        await assertSafeUrl(targetUrl);
      } catch (err) {
        const message =
          err instanceof UnsafeUrlError ? err.message : "Unsafe URL blocked";
        return NextResponse.json({ error: message }, { status: 400 });
      }
    }

    if (sid) {
      const { createServiceClient } = await import("@ragify/core/supabase/service");
      const service = createServiceClient();
      const { data: existing } = await service
        .from("sources")
        .select("id, url")
        .eq("id", sid)
        .single();
      if (!existing) return NextResponse.json({ error: "Source not found" }, { status: 404 });
      targetUrl = existing.url;
    } else if (targetUrl) {
      const ensured = await ensureSource(botId, targetUrl);
      if ("error" in ensured) {
        return NextResponse.json({ error: ensured.error }, { status: 500 });
      }
      sid = ensured.id;
    }

    if (!sid || !targetUrl) {
      return NextResponse.json({ error: "Bad state" }, { status: 500 });
    }

    log({ msg: "crawl_started", bot_id: botId, source_id: sid, ip: getClientIp(req) });

    const result = await processSourceCrawl(botId, sid, targetUrl);

    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? "Crawl failed" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      chunks: result.chunks,
      title: result.title,
      sourceId: sid,
      message: `Indexed ${result.chunks} chunks from ${result.title ?? targetUrl}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logError("crawl_unhandled", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
