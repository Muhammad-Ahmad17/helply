import {
  deleteChunksBySource,
  insertChunks,
  updateSource,
} from "../db/index.js";
import { chunkText } from "../ai/chunk.js";
import { embedPassages } from "../ai/embeddings.js";
import { log, logError } from "../log.js";
import {
  assertIndexEnv,
  MAX_CHUNKS_PER_CRAWL,
  MAX_TEXT_CONTENT_CHARS,
  type IndexJobResult,
} from "../source-index.js";
import { extractTextFromPdf } from "./pdf.js";

export { MAX_TEXT_CONTENT_CHARS } from "../source-index.js";

export async function indexSourceText(
  botId: string,
  sourceId: string,
  text: string,
  title: string
): Promise<IndexJobResult> {
  const envError = assertIndexEnv();
  if (envError) return { ok: false, error: envError };

  const trimmed = text.trim();
  if (!trimmed) return { ok: false, error: "Content is empty." };
  if (trimmed.length > MAX_TEXT_CONTENT_CHARS) {
    return {
      ok: false,
      error: `Content too long (max ${MAX_TEXT_CONTENT_CHARS.toLocaleString()} characters).`,
    };
  }

  try {
    await updateSource(sourceId, { status: "crawling" });

    const allChunks = chunkText(trimmed);
    const chunks = allChunks.slice(0, MAX_CHUNKS_PER_CRAWL);
    if (chunks.length === 0) {
      throw new Error("No indexable text after processing.");
    }

    await deleteChunksBySource(sourceId);
    const embeddings = await embedPassages(chunks.map((c) => c.content));

    await insertChunks(
      chunks.map((c, i) => ({
        bot_id: botId,
        source_id: sourceId,
        content: c.content,
        embedding: embeddings[i],
        token_count: c.tokenCount,
      }))
    );

    const truncated = allChunks.length > chunks.length;
    await updateSource(sourceId, {
      status: "ready",
      title,
      last_crawled_at: new Date().toISOString(),
      error_message: truncated
        ? `Indexed first ${chunks.length} of ${allChunks.length} chunks (plan limit).`
        : null,
    });

    log({ msg: "source_indexed", bot_id: botId, source_id: sourceId, chunks: chunks.length });
    return { ok: true, chunks: chunks.length, title };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logError("source_index_failed", err, { bot_id: botId, source_id: sourceId });
    await updateSource(sourceId, { status: "error", error_message: message });
    return { ok: false, error: message };
  }
}

export async function indexSourcePdf(
  botId: string,
  sourceId: string,
  pdfBuffer: Buffer,
  title: string
): Promise<IndexJobResult> {
  try {
    const text = await extractTextFromPdf(pdfBuffer);
    return indexSourceText(botId, sourceId, text, title);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await updateSource(sourceId, { status: "error", error_message: message });
    return { ok: false, error: message };
  }
}
