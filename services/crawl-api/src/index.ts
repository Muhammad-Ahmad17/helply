import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { getSupabaseUrl } from "@ragify/core/supabase/service";
import { crawlPost } from "./routes/crawl.js";

function validateEnv() {
  const missing: string[] = [];
  try {
    getSupabaseUrl();
  } catch {
    missing.push("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL");
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    missing.push("SUPABASE_SERVICE_ROLE_KEY");
  }
  if (!process.env.SUPABASE_ANON_KEY) missing.push("SUPABASE_ANON_KEY");
  if (!process.env.JINA_API_KEY) missing.push("JINA_API_KEY");
  if (missing.length > 0) {
    console.error(`[crawl-api] Missing required env: ${missing.join(", ")}`);
    process.exit(1);
  }
}

validateEnv();

const app = new Hono();

app.get("/health", (c) => c.json({ ok: true, service: "crawl-api" }));
app.post("/api/crawl", crawlPost);

const port = Number(process.env.PORT ?? 3002);
console.log(`[crawl-api] Listening on :${port}`);
serve({ fetch: app.fetch, port });
