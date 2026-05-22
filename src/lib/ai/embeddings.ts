// Jina AI embeddings client with batching and concurrency control.
import pLimit from "p-limit";

const JINA_API = "https://api.jina.ai/v1/embeddings";
const MODEL = "jina-embeddings-v3";
const DIM = 1024;
const BATCH_SIZE = 32;
const CONCURRENCY = 2;

type Task = "retrieval.passage" | "retrieval.query";

interface JinaResponse {
  data: Array<{ embedding: number[]; index: number }>;
  usage?: { total_tokens: number; prompt_tokens: number };
}

const limit = pLimit(CONCURRENCY);

async function callJina(texts: string[], task: Task): Promise<number[][]> {
  if (!process.env.JINA_API_KEY) {
    throw new Error("JINA_API_KEY is not set. Get one at https://jina.ai/?sui=apikey");
  }

  const res = await fetch(JINA_API, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.JINA_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      task,
      dimensions: DIM,
      input: texts,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Jina embeddings failed (${res.status}): ${body}`);
  }

  const json = (await res.json()) as JinaResponse;
  return json.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

async function callJinaBatched(texts: string[], task: Task): Promise<number[][]> {
  if (texts.length === 0) return [];

  const batches: string[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    batches.push(texts.slice(i, i + BATCH_SIZE));
  }

  const results = await Promise.all(
    batches.map((batch) => limit(() => callJina(batch, task)))
  );

  return results.flat();
}

export async function embedPassages(texts: string[]): Promise<number[][]> {
  return callJinaBatched(texts, "retrieval.passage");
}

export async function embedQuery(text: string): Promise<number[]> {
  const [vec] = await callJina([text], "retrieval.query");
  return vec;
}

/** Race embed against a timeout — returns null if Jina is too slow (Hobby 10s limit). */
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

export const EMBEDDING_DIM = DIM;
