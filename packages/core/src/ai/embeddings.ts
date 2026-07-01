// Self-hosted embeddings via apps/embed HTTP service (replaces Jina).
import pLimit from "p-limit";

export const EMBEDDING_DIM = 384;
const BATCH_SIZE = 16;
const CONCURRENCY = 2;
const limit = pLimit(CONCURRENCY);

function embedUrl(): string {
  const url = process.env.EMBED_URL;
  if (!url) throw new Error("EMBED_URL is not set");
  return url.replace(/\/$/, "");
}

function embedHeaders(): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const key = process.env.EMBED_API_KEY;
  if (key) headers.Authorization = `Bearer ${key}`;
  return headers;
}

async function callEmbed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const res = await fetch(`${embedUrl()}/embed`, {
    method: "POST",
    headers: embedHeaders(),
    body: JSON.stringify({ texts }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Embed service failed (${res.status}): ${body}`);
  }

  const json = (await res.json()) as { embeddings: number[][] };
  return json.embeddings;
}

async function callEmbedBatched(texts: string[]): Promise<number[][]> {
  const batches: string[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    batches.push(texts.slice(i, i + BATCH_SIZE));
  }
  const results = await Promise.all(
    batches.map((batch) => limit(() => callEmbed(batch)))
  );
  return results.flat();
}

export async function embedPassages(texts: string[]): Promise<number[][]> {
  return callEmbedBatched(texts);
}

export async function embedQuery(text: string): Promise<number[]> {
  const [vec] = await callEmbed([text]);
  return vec;
}

export async function embedQueryWithTimeout(
  text: string,
  timeoutMs = 3500
): Promise<number[] | null> {
  try {
    return await Promise.race([
      embedQuery(text),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
  } catch {
    return null;
  }
}

export async function checkEmbedHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${embedUrl()}/health`, { signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}
