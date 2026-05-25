import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { chatOptions, chatPost, botPublicGet } from "./routes/chat.js";

const app = new Hono();

app.get("/health", (c) => c.json({ ok: true, service: "chat-api" }));
app.options("/api/chat", chatOptions);
app.post("/api/chat", chatPost);
app.get("/api/bots/:botId", botPublicGet);

const port = Number(process.env.PORT ?? 3001);
console.log(`[chat-api] Listening on :${port}`);
serve({ fetch: app.fetch, port });
