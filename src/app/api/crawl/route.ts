// POST /api/crawl
// Authenticated endpoint — enqueues a crawl job (or runs inline for single URL).
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { assertSafeUrl, UnsafeUrlError, discoverFromSitemap } from "@/lib/crawler";
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

    const jobs = discovered.map((discoveredUrl) => ({
      bot_id: botId,
      url: discoveredUrl,
      status: "pending" as const,
    }));

    const { error: jobError } = await service.from("crawl_jobs").insert(jobs);
    if (jobError) {
      return NextResponse.json({ error: jobError.message }, { status: 500 });
    }

    log({
      msg: "site_crawl_enqueued",
      bot_id: botId,
      user_id: user.id,
      url_count: discovered.length,
    });

    return NextResponse.json({
      ok: true,
      enqueued: discovered.length,
      message: `Enqueued ${discovered.length} URLs for crawling`,
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

  const { error: jobError } = await service.from("crawl_jobs").insert({
    bot_id: botId,
    source_id: sid,
    url: targetUrl,
    status: "pending",
  });

  if (jobError) {
    logError("crawl_enqueue_failed", jobError, { bot_id: botId });
    return NextResponse.json({ error: jobError.message }, { status: 500 });
  }

  log({
    msg: "crawl_enqueued",
    bot_id: botId,
    source_id: sid,
    ip: getClientIp(req),
  });

  return NextResponse.json({
    ok: true,
    enqueued: true,
    sourceId: sid,
    message: "Crawl job enqueued. Refresh in a moment to see status.",
  });
}
