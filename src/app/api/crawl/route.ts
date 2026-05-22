// POST /api/crawl
// Single URL: crawls immediately. Site-wide: enqueues + processes first batch inline.
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { assertSafeUrl, UnsafeUrlError, discoverFromSitemap } from "@/lib/crawler";
import { processCrawlJob } from "@/lib/crawl-worker";
import { crawlLimiter, checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/security";
import { log, logError } from "@/lib/log";

export const maxDuration = 60;

const bodySchema = z.object({
  botId: z.string().uuid(),
  sourceId: z.string().uuid().optional(),
  url: z.string().url().optional(),
  crawlSite: z.boolean().optional(),
});

const INLINE_SITE_BATCH = 3;

export async function POST(req: Request) {
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

  const rate = await checkRateLimit(crawlLimiter, user.id);
  if (!rate.success) {
    return NextResponse.json(
      { error: "Crawl rate limit exceeded. Try again later." },
      { status: 429 }
    );
  }

  const { data: bot } = await supabase
    .from("bots")
    .select("id, owner_id, plan")
    .eq("id", botId)
    .maybeSingle();
  if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 });

  const service = createServiceClient();

  if (crawlSite && url) {
    try {
      await assertSafeUrl(url);
    } catch (err) {
      const message =
        err instanceof UnsafeUrlError ? err.message : "Unsafe URL blocked";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const discovered = await discoverFromSitemap(url, bot.plan ?? "free");
    if (discovered.length === 0) {
      return NextResponse.json({ error: "No URLs discovered" }, { status: 400 });
    }

    const { data: insertedJobs, error: jobError } = await service
      .from("crawl_jobs")
      .insert(
        discovered.map((discoveredUrl) => ({
          bot_id: botId,
          url: discoveredUrl,
          status: "pending" as const,
        }))
      )
      .select("id, bot_id, source_id, url, attempts");

    if (jobError || !insertedJobs) {
      return NextResponse.json({ error: jobError?.message ?? "Failed to enqueue" }, { status: 500 });
    }

    // Process first batch inline (Hobby plan has no minute-level cron)
    const batch = insertedJobs.slice(0, INLINE_SITE_BATCH);
    for (const job of batch) {
      await service
        .from("crawl_jobs")
        .update({ status: "running", started_at: new Date().toISOString(), attempts: 1 })
        .eq("id", job.id);
      await processCrawlJob({ ...job, attempts: 1 });
    }

    const remaining = discovered.length - batch.length;
    log({
      msg: "site_crawl_enqueued",
      bot_id: botId,
      user_id: user.id,
      url_count: discovered.length,
      processed_inline: batch.length,
    });

    return NextResponse.json({
      ok: true,
      enqueued: discovered.length,
      processedInline: batch.length,
      message:
        remaining > 0
          ? `Started ${batch.length} pages now. ${remaining} queued — rest run on the daily crawl job, or crawl URLs individually.`
          : `Crawled ${batch.length} pages.`,
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
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  if (sid) {
    const { data: existing } = await service
      .from("sources")
      .select("id, url")
      .eq("id", sid)
      .single();
    if (!existing) return NextResponse.json({ error: "Source not found" }, { status: 404 });
    targetUrl = existing.url;
  } else if (targetUrl) {
    const { data: existing } = await service
      .from("sources")
      .select("id")
      .eq("bot_id", botId)
      .eq("url", targetUrl)
      .maybeSingle();

    if (existing) {
      sid = existing.id;
    } else {
      const { data: inserted, error: insertError } = await service
        .from("sources")
        .insert({ bot_id: botId, url: targetUrl, status: "pending" })
        .select("id")
        .single();
      if (insertError || !inserted) {
        return NextResponse.json(
          { error: insertError?.message ?? "Failed to create source" },
          { status: 500 }
        );
      }
      sid = inserted.id;
    }
  }

  if (!sid || !targetUrl) {
    return NextResponse.json({ error: "Bad state" }, { status: 500 });
  }

  const { data: job, error: jobError } = await service
    .from("crawl_jobs")
    .insert({
      bot_id: botId,
      source_id: sid,
      url: targetUrl,
      status: "running",
      started_at: new Date().toISOString(),
      attempts: 1,
    })
    .select("id, bot_id, source_id, url, attempts")
    .single();

  if (jobError || !job) {
    logError("crawl_enqueue_failed", jobError, { bot_id: botId });
    return NextResponse.json({ error: jobError?.message ?? "Failed to start crawl" }, { status: 500 });
  }

  log({ msg: "crawl_started", bot_id: botId, source_id: sid, ip: getClientIp(req) });

  const result = await processCrawlJob(job);

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
}
