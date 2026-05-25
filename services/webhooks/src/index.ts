import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { lemonPost } from "./routes/lemon.js";

const app = new Hono();

app.get("/health", (c) => c.json({ ok: true, service: "webhooks" }));
app.post("/api/webhooks/lemon", lemonPost);

const port = Number(process.env.PORT ?? 3003);
console.log(`[webhooks] Listening on :${port}`);
serve({ fetch: app.fetch, port });
