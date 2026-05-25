import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { crawlPost } from "./routes/crawl.js";

const app = new Hono();

app.get("/health", (c) => c.json({ ok: true, service: "crawl-api" }));
app.post("/api/crawl", crawlPost);

const port = Number(process.env.PORT ?? 3002);
console.log(`[crawl-api] Listening on :${port}`);
serve({ fetch: app.fetch, port });
