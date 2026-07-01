import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { embedTexts, getExtractor } from "./model.js";

const app = new Hono();
const apiKey = process.env.EMBED_API_KEY;

function checkAuth(authHeader: string | undefined): boolean {
  if (!apiKey) return true;
  return authHeader === `Bearer ${apiKey}`;
}

app.get("/health", async (c) => {
  try {
    await getExtractor();
    return c.json({ ok: true, service: "embed", model: process.env.EMBED_MODEL });
  } catch (err) {
    return c.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      503
    );
  }
});

app.post("/embed", async (c) => {
  if (!checkAuth(c.req.header("authorization"))) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const body = await c.req.json().catch(() => null) as { texts?: string[] } | null;
  const texts = body?.texts;
  if (!texts?.length || texts.length > 32) {
    return c.json({ error: "Provide texts array (1-32 items)" }, 400);
  }

  try {
    const embeddings = await embedTexts(texts);
    return c.json({ embeddings, dim: embeddings[0]?.length ?? 384 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message }, 500);
  }
});

const port = Number(process.env.EMBED_PORT ?? 8080);
console.log(`[embed] Preloading model ${process.env.EMBED_MODEL ?? "Xenova/bge-small-en-v1.5"}...`);
getExtractor()
  .then(() => {
    console.log(`[embed] Model ready. Listening on :${port}`);
    serve({ fetch: app.fetch, port });
  })
  .catch((err) => {
    console.error("[embed] Failed to load model:", err);
    process.exit(1);
  });
