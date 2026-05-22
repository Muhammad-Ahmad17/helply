// POST /api/crawl
// Authenticated endpoint that fetches a URL, chunks the text, embeds each
// chunk, and stores them in pgvector. Owners only — RLS enforced by reading
// the bot through the request-bound Supabase client first.
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { crawlUrl } from "@/lib/crawler";
import { chunkText } from "@/lib/ai/chunk";
import { embedPassages } from "@/lib/ai/embeddings";

export const maxDuration = 60;

const bodySchema = z.object({
  botId: z.string().uuid(),
  sourceId: z.string().uuid().optional(),
  url: z.string().url().optional(),
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

  const { botId, sourceId, url } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: bot } = await supabase
    .from("bots")
    .select("id, owner_id")
    .eq("id", botId)
    .maybeSingle();
  if (!bot) return NextResponse.json({ error: "Bot not found" }, { status: 404 });

  const service = createServiceClient();

  let sid = sourceId;
  let targetUrl = url;
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

  await service.from("sources").update({ status: "crawling" }).eq("id", sid);

  try {
    const result = await crawlUrl(targetUrl);
    const chunks = chunkText(result.text);

    if (chunks.length === 0) {
      throw new Error("No text content found on page.");
    }

    await service.from("chunks").delete().eq("source_id", sid);

    const embeddings = await embedPassages(chunks.map((c) => c.content));

    const rows = chunks.map((c, i) => ({
      bot_id: botId,
      source_id: sid,
      content: c.content,
      embedding: embeddings[i],
      token_count: c.tokenCount,
    }));

    // Insert in batches of 50 to keep request bodies under Supabase limits.
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

    return NextResponse.json({
      ok: true,
      chunks: chunks.length,
      title: result.title,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await service
      .from("sources")
      .update({ status: "error", error_message: message })
      .eq("id", sid);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
