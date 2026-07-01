import { z } from "zod";
import type { Context } from "hono";
import {
  createContentSource,
  getBotForOwner,
  getSql,
  updateSourceRawContent,
} from "@ragify/core/db";
import {
  indexSourcePdf,
  indexSourceText,
  MAX_TEXT_CONTENT_CHARS,
} from "@ragify/core/content";
import { MAX_PDF_SIZE } from "@ragify/core/content/pdf";
import { crawlLimiter, checkRateLimit } from "@ragify/core/rate-limit";
import { logError } from "@ragify/core/log";

const textSchema = z.object({
  botId: z.string().uuid(),
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(MAX_TEXT_CONTENT_CHARS),
});

export async function sourceTextPost(c: Context) {
  const user = c.get("user");

  try {
    const parsed = textSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: "Provide botId, title, and content." }, 400);
    }

    let rate;
    try {
      rate = await checkRateLimit(crawlLimiter, user.id);
    } catch {
      rate = { success: true, limit: 999, remaining: 999, reset: Date.now() + 60_000 };
    }
    if (!rate.success) {
      return c.json({ error: "Rate limit exceeded. Try again later." }, 429);
    }

    const { botId, title, content } = parsed.data;
    const bot = await getBotForOwner(botId, user.id);
    if (!bot) return c.json({ error: "Bot not found" }, 404);

    const source = await createContentSource(botId, "text", title, content);
    const result = await indexSourceText(botId, source.id, content, title);
    if (!result.ok) return c.json({ error: result.error ?? "Indexing failed" }, 500);

    return c.json({
      ok: true,
      sourceId: source.id,
      chunks: result.chunks,
      message: `Indexed ${result.chunks} chunks from "${title}"`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logError("source_text_unhandled", err);
    return c.json({ error: message }, 500);
  }
}

export async function sourcePdfPost(c: Context) {
  const user = c.get("user");

  try {
    const body = await c.req.parseBody();
    const botId = typeof body.botId === "string" ? body.botId : null;
    const file = body.file;

    if (!botId || !z.string().uuid().safeParse(botId).success) {
      return c.json({ error: "Provide botId." }, 400);
    }
    if (!(file instanceof File)) {
      return c.json({ error: "Upload a PDF file." }, 400);
    }
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      return c.json({ error: "Only PDF files are supported." }, 400);
    }
    if (file.size > MAX_PDF_SIZE) {
      return c.json({ error: `PDF too large (max ${MAX_PDF_SIZE / 1024 / 1024} MB).` }, 400);
    }

    let rate;
    try {
      rate = await checkRateLimit(crawlLimiter, user.id);
    } catch {
      rate = { success: true, limit: 999, remaining: 999, reset: Date.now() + 60_000 };
    }
    if (!rate.success) {
      return c.json({ error: "Rate limit exceeded. Try again later." }, 429);
    }

    const bot = await getBotForOwner(botId, user.id);
    if (!bot) return c.json({ error: "Bot not found" }, 404);

    const title = file.name.replace(/\.pdf$/i, "") || "PDF document";
    const buffer = Buffer.from(await file.arrayBuffer());

    const source = await createContentSource(botId, "pdf", title);
    const result = await indexSourcePdf(botId, source.id, buffer, title);
    if (!result.ok) return c.json({ error: result.error ?? "PDF indexing failed" }, 500);

    await updateSourceRawContent(source.id, `[pdf:${file.name}]`);

    return c.json({
      ok: true,
      sourceId: source.id,
      chunks: result.chunks,
      message: `Indexed ${result.chunks} chunks from ${file.name}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logError("source_pdf_unhandled", err);
    return c.json({ error: message }, 500);
  }
}

const reindexSchema = z.object({
  botId: z.string().uuid(),
  sourceId: z.string().uuid(),
});

export async function sourceReindexPost(c: Context) {
  const user = c.get("user");

  try {
    const parsed = reindexSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
      return c.json({ error: "Provide botId and sourceId." }, 400);
    }

    const { botId, sourceId } = parsed.data;
    const bot = await getBotForOwner(botId, user.id);
    if (!bot) return c.json({ error: "Bot not found" }, 404);

    const sql = getSql();
    const [source] = await sql<
      { kind: string; raw_content: string | null; title: string | null; url: string }[]
    >`
      select kind, raw_content, title, url from sources
      where id = ${sourceId} and bot_id = ${botId}
      limit 1
    `;
    if (!source) return c.json({ error: "Source not found" }, 404);

    if (source.kind === "text") {
      if (!source.raw_content) {
        return c.json({ error: "No stored text to re-index." }, 400);
      }
      const result = await indexSourceText(
        botId,
        sourceId,
        source.raw_content,
        source.title ?? "Text note"
      );
      if (!result.ok) return c.json({ error: result.error ?? "Re-index failed" }, 500);
      return c.json({
        ok: true,
        chunks: result.chunks,
        message: `Re-indexed ${result.chunks} chunks`,
      });
    }

    if (source.kind === "pdf") {
      return c.json({ error: "Re-upload the PDF to refresh this source." }, 400);
    }

    const { processSourceCrawl } = await import("@ragify/core/crawl-worker");
    const result = await processSourceCrawl(botId, sourceId, source.url);
    if (!result.ok) return c.json({ error: result.error ?? "Crawl failed" }, 500);
    return c.json({
      ok: true,
      chunks: result.chunks,
      message: `Indexed ${result.chunks} chunks from ${result.title ?? source.url}`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logError("source_reindex_unhandled", err);
    return c.json({ error: message }, 500);
  }
}
