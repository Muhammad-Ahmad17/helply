import postgres from "postgres";
import { randomUUID } from "crypto";

let _sql: ReturnType<typeof postgres> | null = null;

export function getSql() {
  if (!_sql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    _sql = postgres(url, { max: 10, idle_timeout: 20 });
  }
  return _sql;
}

export async function closeSql() {
  if (_sql) {
    await _sql.end();
    _sql = null;
  }
}

export type User = {
  id: string;
  clerk_user_id: string;
  email: string | null;
  plan: string;
  is_admin: boolean;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
};

export type Bot = {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  welcome_message: string;
  system_prompt: string;
  primary_color: string;
  allowed_origins: string[];
  plan: string;
  monthly_message_count: number;
  quota_alert_sent: string;
};

export async function upsertUserFromClerk(
  clerkUserId: string,
  email?: string | null
): Promise<User> {
  const sql = getSql();
  const [row] = await sql<User[]>`
    insert into users (clerk_user_id, email)
    values (${clerkUserId}, ${email ?? null})
    on conflict (clerk_user_id) do update
      set email = coalesce(excluded.email, users.email),
          updated_at = now()
    returning *
  `;
  return row;
}

export async function getUserByClerkId(clerkUserId: string): Promise<User | null> {
  const sql = getSql();
  const [row] = await sql<User[]>`
    select * from users where clerk_user_id = ${clerkUserId} limit 1
  `;
  return row ?? null;
}

export async function getUserById(id: string): Promise<User | null> {
  const sql = getSql();
  const [row] = await sql<User[]>`select * from users where id = ${id} limit 1`;
  return row ?? null;
}

export async function updateUserPlan(
  userId: string,
  plan: string,
  stripeCustomerId?: string,
  stripeSubscriptionId?: string
) {
  const sql = getSql();
  await sql`
    update users set
      plan = ${plan},
      stripe_customer_id = coalesce(${stripeCustomerId ?? null}, stripe_customer_id),
      stripe_subscription_id = coalesce(${stripeSubscriptionId ?? null}, stripe_subscription_id),
      updated_at = now()
    where id = ${userId}
  `;
  await sql`update bots set plan = ${plan} where owner_id = ${userId}`;
}

export async function getBotById(botId: string): Promise<Bot | null> {
  const sql = getSql();
  const [row] = await sql<Bot[]>`select * from bots where id = ${botId} limit 1`;
  return row ?? null;
}

export async function getBotForOwner(
  botId: string,
  ownerId: string
): Promise<Bot | null> {
  const sql = getSql();
  const [row] = await sql<Bot[]>`
    select * from bots where id = ${botId} and owner_id = ${ownerId} limit 1
  `;
  return row ?? null;
}

export async function getBotsByOwner(ownerId: string): Promise<Bot[]> {
  const sql = getSql();
  return sql<Bot[]>`select * from bots where owner_id = ${ownerId} order by created_at desc`;
}

export async function createBot(
  ownerId: string,
  name: string,
  slug: string
): Promise<Bot> {
  const sql = getSql();
  const user = await getUserById(ownerId);
  const plan = user?.plan ?? "free";
  const [row] = await sql<Bot[]>`
    insert into bots (owner_id, name, slug, plan)
    values (${ownerId}, ${name}, ${slug}, ${plan})
    returning *
  `;
  return row;
}

export async function deleteBot(botId: string, ownerId: string): Promise<boolean> {
  const sql = getSql();
  const result = await sql`
    delete from bots where id = ${botId} and owner_id = ${ownerId}
  `;
  return result.count > 0;
}

export async function updateBot(
  botId: string,
  ownerId: string,
  data: Partial<
    Pick<
      Bot,
      | "name"
      | "welcome_message"
      | "primary_color"
      | "system_prompt"
      | "allowed_origins"
    >
  >
) {
  const sql = getSql();
  const bot = await getBotForOwner(botId, ownerId);
  if (!bot) return null;
  const [row] = await sql<Bot[]>`
    update bots set
      name = ${data.name ?? bot.name},
      welcome_message = ${data.welcome_message ?? bot.welcome_message},
      primary_color = ${data.primary_color ?? bot.primary_color},
      system_prompt = ${data.system_prompt ?? bot.system_prompt},
      allowed_origins = ${data.allowed_origins ?? bot.allowed_origins}
    where id = ${botId} and owner_id = ${ownerId}
    returning *
  `;
  return row;
}

export async function matchChunks(
  botId: string,
  embedding: number[],
  count = 6
): Promise<Array<{ id: string; content: string; similarity: number }>> {
  const sql = getSql();
  const vec = `[${embedding.join(",")}]`;
  return sql`
    select * from match_chunks(${vec}::vector, ${botId}::uuid, ${count})
  `;
}

export type ChunkMatch = {
  id: string;
  content: string;
  similarity: number;
  source_label: string;
  source_kind: string;
};

export async function matchChunksEnriched(
  botId: string,
  embedding: number[],
  count = 8
): Promise<ChunkMatch[]> {
  const sql = getSql();
  const vec = `[${embedding.join(",")}]`;
  return sql<ChunkMatch[]>`
    select
      c.id,
      c.content,
      1 - (c.embedding <=> ${vec}::vector) as similarity,
      coalesce(nullif(s.title, ''), s.url) as source_label,
      s.kind::text as source_kind
    from chunks c
    join sources s on s.id = c.source_id
    where c.bot_id = ${botId}
    order by c.embedding <=> ${vec}::vector
    limit ${count}
  `;
}

export async function consumeMessageQuota(botId: string) {
  const sql = getSql();
  const [row] = await sql<
    Array<{ allowed: boolean; remaining: number; plan: string }>
  >`select * from consume_message_quota(${botId}::uuid)`;
  return row ?? { allowed: false, remaining: 0, plan: "unknown" };
}

export async function insertChunks(
  rows: Array<{
    bot_id: string;
    source_id: string;
    content: string;
    embedding: number[];
    token_count: number;
  }>
) {
  const sql = getSql();
  for (let i = 0; i < rows.length; i += 50) {
    const slice = rows.slice(i, i + 50);
    for (const r of slice) {
      const vec = `[${r.embedding.join(",")}]`;
      await sql`
        insert into chunks (bot_id, source_id, content, embedding, token_count)
        values (${r.bot_id}, ${r.source_id}, ${r.content}, ${vec}::vector, ${r.token_count})
      `;
    }
  }
}

export async function deleteChunksBySource(sourceId: string) {
  const sql = getSql();
  await sql`delete from chunks where source_id = ${sourceId}`;
}

export async function ensureSource(botId: string, url: string) {
  const sql = getSql();
  const [existing] = await sql<{ id: string }[]>`
    select id from sources where bot_id = ${botId} and url = ${url} limit 1
  `;
  if (existing) return existing;

  const [inserted] = await sql<{ id: string }[]>`
    insert into sources (bot_id, url, kind, status)
    values (${botId}, ${url}, 'url', 'pending')
    returning id
  `;
  return inserted;
}

export type SourceKind = "url" | "text" | "pdf";

export async function createContentSource(
  botId: string,
  kind: "text" | "pdf",
  title: string,
  rawContent?: string | null
) {
  const sql = getSql();
  const syntheticUrl = `ragify://${kind}/${randomUUID()}`;
  const [inserted] = await sql<{ id: string }[]>`
    insert into sources (bot_id, url, title, kind, raw_content, status)
    values (${botId}, ${syntheticUrl}, ${title}, ${kind}, ${rawContent ?? null}, 'pending')
    returning id
  `;
  return inserted;
}

export async function updateSourceRawContent(sourceId: string, rawContent: string) {
  const sql = getSql();
  await sql`update sources set raw_content = ${rawContent} where id = ${sourceId}`;
}

export async function updateSource(
  sourceId: string,
  data: Partial<{
    status: string;
    title: string | null;
    error_message: string | null;
    last_crawled_at: string | null;
  }>
) {
  const sql = getSql();
  await sql`
    update sources set
      status = coalesce(${data.status ?? null}, status),
      title = coalesce(${data.title ?? null}, title),
      error_message = ${data.error_message ?? null},
      last_crawled_at = coalesce(${data.last_crawled_at ?? null}, last_crawled_at)
    where id = ${sourceId}
  `;
}

export async function getSourcesByBot(botId: string, ownerId: string) {
  const sql = getSql();
  return sql`
    select s.* from sources s
    join bots b on b.id = s.bot_id
    where s.bot_id = ${botId} and b.owner_id = ${ownerId}
    order by s.created_at desc
  `;
}

export async function countChunksByBot(botId: string): Promise<number> {
  const sql = getSql();
  const [row] = await sql<[{ count: string }]>`
    select count(*)::text as count from chunks where bot_id = ${botId}
  `;
  return Number(row?.count ?? 0);
}

export async function createCrawlJob(
  botId: string,
  url: string,
  sourceId?: string,
  bullJobId?: string
) {
  const sql = getSql();
  const [row] = await sql<{ id: string }[]>`
    insert into crawl_jobs (bot_id, source_id, url, status, bull_job_id)
    values (${botId}, ${sourceId ?? null}, ${url}, 'pending', ${bullJobId ?? null})
    returning id
  `;
  return row;
}

export async function updateCrawlJob(
  jobId: string,
  data: Partial<{
    status: string;
    last_error: string | null;
    started_at: string | null;
    finished_at: string | null;
    attempts: number;
  }>
) {
  const sql = getSql();
  await sql`
    update crawl_jobs set
      status = coalesce(${data.status ?? null}, status),
      last_error = ${data.last_error ?? null},
      started_at = coalesce(${data.started_at ?? null}, started_at),
      finished_at = coalesce(${data.finished_at ?? null}, finished_at),
      attempts = coalesce(${data.attempts ?? null}, attempts)
    where id = ${jobId}
  `;
}

export async function getCrawlJobsByBot(botId: string, ownerId: string) {
  const sql = getSql();
  return sql`
    select cj.* from crawl_jobs cj
    join bots b on b.id = cj.bot_id
    where cj.bot_id = ${botId} and b.owner_id = ${ownerId}
    order by cj.created_at desc
    limit 50
  `;
}

export async function webhookAlreadyProcessed(eventId: string): Promise<boolean> {
  const sql = getSql();
  const [row] = await sql<{ id: string }[]>`
    select id from processed_webhooks where event_id = ${eventId} limit 1
  `;
  return !!row;
}

export async function recordWebhook(
  eventId: string,
  eventName: string,
  payload: unknown
) {
  const sql = getSql();
  await sql`
    insert into processed_webhooks (event_id, event_name, payload)
    values (${eventId}, ${eventName}, ${sql.json(payload as never)})
    on conflict (event_id) do nothing
  `;
}

export async function getUserByStripeCustomerId(customerId: string) {
  const sql = getSql();
  const [row] = await sql<User[]>`
    select * from users where stripe_customer_id = ${customerId} limit 1
  `;
  return row ?? null;
}

export async function countAdminStats() {
  const sql = getSql();
  const [bots] = await sql<[{ count: string }]>`select count(*)::text as count from bots`;
  const [sources] = await sql<[{ count: string }]>`select count(*)::text as count from sources`;
  const [conversations] =
    await sql<[{ count: string }]>`select count(*)::text as count from conversations`;
  const [activeJobs] = await sql<[{ count: string }]>`
    select count(*)::text as count from crawl_jobs where status in ('pending','running','error')
  `;
  const users = await sql<User[]>`select * from users`;
  const failedCrawls = await sql`
    select id, bot_id, url, status, last_error, created_at from crawl_jobs
    where status = 'error' order by created_at desc limit 20
  `;
  const planCounts = { free: 0, starter: 0, pro: 0 };
  for (const u of users) {
    const p = (u.plan ?? "free") as keyof typeof planCounts;
    if (p in planCounts) planCounts[p]++;
  }
  return {
    bots: Number(bots.count),
    sources: Number(sources.count),
    conversations: Number(conversations.count),
    activeCrawlJobs: Number(activeJobs.count),
    users: users.length,
    planCounts,
    failedCrawls,
  };
}

export async function logConversation(
  botId: string,
  visitorId: string,
  ipHash: string,
  userMessage: string,
  assistantMessage: string
) {
  const sql = getSql();
  const [conv] = await sql<{ id: string }[]>`
    select id from conversations
    where bot_id = ${botId} and visitor_id = ${visitorId}
    order by created_at desc limit 1
  `;
  let convId = conv?.id;
  if (!convId) {
    const [created] = await sql<{ id: string }[]>`
      insert into conversations (bot_id, visitor_id, ip_hash)
      values (${botId}, ${visitorId}, ${ipHash})
      returning id
    `;
    convId = created.id;
  }
  await sql`
    insert into messages (conversation_id, role, content) values
    (${convId}, 'user', ${userMessage}),
    (${convId}, 'assistant', ${assistantMessage})
  `;
}
