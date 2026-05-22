// Jina AI embeddings client.
// Why Jina: free tier ~1M tokens/month, simple REST API, 1024-dim vectors,
// no client-side wasm bundle. To swap providers later, change only this file.

const JINA_API = "https://api.jina.ai/v1/embeddings";
const MODEL = "jina-embeddings-v3";
const DIM = 1024;

type Task = "retrieval.passage" | "retrieval.query";

interface JinaResponse {
  data: Array<{ embedding: number[]; index: number }>;
  usage?: { total_tokens: number; prompt_tokens: number };
}

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
  return json.data
    .sort((a, b) => a.index - b.index)
    .map((d) => d.embedding);
}

/**
 * Embed text(s) for STORING in the DB (a document/passage being indexed).
 * Jina v3 produces task-specific embeddings; using the right task improves
 * retrieval quality by 5-15% vs a generic embedding.
 */
export async function embedPassages(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  return callJina(texts, "retrieval.passage");
}

/**
 * Embed a search QUERY (the user's chat question).
 */
export async function embedQuery(text: string): Promise<number[]> {
  const [vec] = await callJina([text], "retrieval.query");
  return vec;
}

export const EMBEDDING_DIM = DIM;
