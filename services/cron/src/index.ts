import { serve } from "@hono/node-server";
import { Hono } from "hono";
import {
  crawlWorkerGet,
  healthCheckGet,
  exportConversationsGet,
  quotaAlertsGet,
} from "./routes/cron.js";

const app = new Hono();

app.get("/health", (c) => c.json({ ok: true, service: "cron" }));
app.get("/api/cron/crawl-worker", crawlWorkerGet);
app.get("/api/cron/health-check", healthCheckGet);
app.get("/api/cron/export-conversations", exportConversationsGet);
app.get("/api/cron/quota-alerts", quotaAlertsGet);

const port = Number(process.env.PORT ?? 3004);
console.log(`[cron] Listening on :${port}`);
serve({ fetch: app.fetch, port });
