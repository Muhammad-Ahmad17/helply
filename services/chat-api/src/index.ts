import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { getSupabaseUrl } from "@ragify/core/supabase/service";
import { chatOptions, chatPost, botPublicGet } from "./routes/chat.js";

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
  if (!process.env.GROQ_API_KEY) missing.push("GROQ_API_KEY");
  if (!process.env.JINA_API_KEY) missing.push("JINA_API_KEY");
  if (missing.length > 0) {
    console.error(`[chat-api] Missing required env: ${missing.join(", ")}`);
    process.exit(1);
  }
}

validateEnv();

const app = new Hono();

app.get("/health", (c) => c.json({ ok: true, service: "chat-api" }));
app.options("/api/chat", chatOptions);
app.post("/api/chat", chatPost);
app.get("/api/bots/:botId", botPublicGet);

const port = Number(process.env.PORT ?? 3001);
console.log(`[chat-api] Listening on :${port}`);
serve({ fetch: app.fetch, port });
