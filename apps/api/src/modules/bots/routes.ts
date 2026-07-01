import { z } from "zod";
import type { Context } from "hono";
import {
  createBot,
  deleteBot,
  getBotForOwner,
  getBotsByOwner,
  getCrawlJobsByBot,
  getSourcesByBot,
  countChunksByBot,
  getSql,
  updateBot,
} from "@ragify/core/db";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

function parseAllowedOrigins(input: string): string[] {
  return input
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((o) => {
      if (o === "*") return "*";
      if (!/^https?:\/\//i.test(o)) return `https://${o}`;
      try {
        const u = new URL(o);
        return `${u.protocol}//${u.host}`;
      } catch {
        return o.replace(/\/$/, "");
      }
    });
}

export async function botsListGet(c: Context) {
  const user = c.get("user");
  const bots = await getBotsByOwner(user.id);
  return c.json({ bots });
}

const createSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url().optional(),
});

export async function botsCreatePost(c: Context) {
  const user = c.get("user");
  const body = createSchema.parse(await c.req.json());
  const slug = `${slugify(body.name)}-${Math.random().toString(36).slice(2, 7)}`;
  const bot = await createBot(user.id, body.name, slug);

  if (body.url) {
    const sql = getSql();
    await sql`
      insert into sources (bot_id, url, kind, status)
      values (${bot.id}, ${body.url}, 'url', 'pending')
    `;
  }

  return c.json({ bot });
}

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  welcome_message: z.string().max(500).optional(),
  primary_color: z.string().max(20).optional(),
  system_prompt: z.string().max(4000).optional(),
  allowed_origins: z.string().optional(),
});

function botIdParam(c: Context): string {
  return c.req.param("botId") ?? "";
}

export async function botsUpdatePatch(c: Context) {
  const user = c.get("user");
  const botId = botIdParam(c);
  const body = updateSchema.parse(await c.req.json());

  const updated = await updateBot(botId, user.id, {
    name: body.name,
    welcome_message: body.welcome_message,
    primary_color: body.primary_color,
    system_prompt: body.system_prompt,
    allowed_origins: body.allowed_origins
      ? parseAllowedOrigins(body.allowed_origins)
      : undefined,
  });

  if (!updated) return c.json({ error: "Not found" }, 404);
  return c.json({ bot: updated });
}

export async function botsDelete(c: Context) {
  const user = c.get("user");
  const botId = botIdParam(c);
  const ok = await deleteBot(botId, user.id);
  if (!ok) return c.json({ error: "Not found" }, 404);
  return c.json({ ok: true });
}

export async function sourcesListGet(c: Context) {
  const user = c.get("user");
  const botId = botIdParam(c);
  const bot = await getBotForOwner(botId, user.id);
  if (!bot) return c.json({ error: "Not found" }, 404);
  const sources = await getSourcesByBot(botId, user.id);
  const chunkCount = await countChunksByBot(botId);
  return c.json({ sources, chunkCount });
}

export async function crawlJobsListGet(c: Context) {
  const user = c.get("user");
  const botId = botIdParam(c);
  const bot = await getBotForOwner(botId, user.id);
  if (!bot) return c.json({ error: "Not found" }, 404);
  const jobs = await getCrawlJobsByBot(botId, user.id);
  return c.json({ jobs });
}

export async function conversationsListGet(c: Context) {
  const user = c.get("user");
  const botId = botIdParam(c);
  const bot = await getBotForOwner(botId, user.id);
  if (!bot) return c.json({ error: "Not found" }, 404);

  const sql = getSql();
  const rows = await sql`
    select c.id, c.visitor_id, c.created_at,
      coalesce(
        json_agg(
          json_build_object('role', m.role, 'content', m.content, 'created_at', m.created_at)
          order by m.created_at
        ) filter (where m.id is not null),
        '[]'::json
      ) as messages
    from conversations c
    left join messages m on m.conversation_id = c.id
    where c.bot_id = ${botId}
    group by c.id
    order by c.created_at desc
    limit 50
  `;
  return c.json({ conversations: rows });
}
