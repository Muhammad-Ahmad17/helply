-- Ragify self-hosted schema (Clerk auth, 384-dim embeddings)
create extension if not exists "vector";
create extension if not exists "pgcrypto";

-- ============================================================================
-- users: synced from Clerk (clerk_user_id = JWT sub)
-- ============================================================================
create table if not exists public.users (
  id              uuid primary key default gen_random_uuid(),
  clerk_user_id   text not null unique,
  email           text,
  plan            text not null default 'free' check (plan in ('free','starter','pro')),
  is_admin        boolean not null default false,
  stripe_customer_id     text,
  stripe_subscription_id text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists users_clerk_idx on public.users (clerk_user_id);

-- ============================================================================
-- bots
-- ============================================================================
create table if not exists public.bots (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references public.users(id) on delete cascade,
  name            text not null,
  slug            text not null unique,
  welcome_message text not null default 'Hi! Ask me anything about this site.',
  system_prompt   text not null default 'You are a helpful assistant. Answer only using the provided context. If you do not know, say so honestly.',
  primary_color   text not null default '#0ea5e9',
  allowed_origins text[] not null default '{}',
  plan            text not null default 'free' check (plan in ('free','starter','pro')),
  monthly_message_count int not null default 0,
  monthly_message_period_start timestamptz not null default date_trunc('month', now()),
  quota_alert_sent text not null default '',
  created_at      timestamptz not null default now()
);

create index if not exists bots_owner_idx on public.bots (owner_id);
create index if not exists bots_plan_idx on public.bots (plan);

-- ============================================================================
-- sources
-- ============================================================================
create type source_status as enum ('pending', 'crawling', 'ready', 'error');

create table if not exists public.sources (
  id              uuid primary key default gen_random_uuid(),
  bot_id          uuid not null references public.bots(id) on delete cascade,
  url             text not null,
  title           text,
  status          source_status not null default 'pending',
  error_message   text,
  last_crawled_at timestamptz,
  created_at      timestamptz not null default now(),
  unique (bot_id, url)
);

create index if not exists sources_bot_idx on public.sources (bot_id);

-- ============================================================================
-- chunks: bge-small-en-v1.5 produces 384-dim vectors
-- ============================================================================
create table if not exists public.chunks (
  id          uuid primary key default gen_random_uuid(),
  bot_id      uuid not null references public.bots(id) on delete cascade,
  source_id   uuid not null references public.sources(id) on delete cascade,
  content     text not null,
  embedding   vector(384) not null,
  token_count int not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists chunks_embedding_idx
  on public.chunks using hnsw (embedding vector_cosine_ops);
create index if not exists chunks_bot_idx on public.chunks (bot_id);

-- ============================================================================
-- conversations + messages
-- ============================================================================
create table if not exists public.conversations (
  id          uuid primary key default gen_random_uuid(),
  bot_id      uuid not null references public.bots(id) on delete cascade,
  visitor_id  text not null,
  ip_hash     text,
  created_at  timestamptz not null default now()
);

create index if not exists conversations_bot_idx on public.conversations (bot_id);

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  role            text not null check (role in ('user', 'assistant')),
  content         text not null,
  created_at      timestamptz not null default now()
);

create index if not exists messages_conv_idx on public.messages (conversation_id, created_at);

-- ============================================================================
-- crawl_jobs (status tracking; BullMQ is primary queue)
-- ============================================================================
create type crawl_job_status as enum ('pending', 'running', 'done', 'error');

create table if not exists public.crawl_jobs (
  id           uuid primary key default gen_random_uuid(),
  bot_id       uuid not null references public.bots(id) on delete cascade,
  source_id    uuid references public.sources(id) on delete cascade,
  url          text not null,
  status       crawl_job_status not null default 'pending',
  bull_job_id  text,
  attempts     int not null default 0,
  last_error   text,
  created_at   timestamptz not null default now(),
  started_at   timestamptz,
  finished_at  timestamptz
);

create index if not exists crawl_jobs_status_idx on public.crawl_jobs (status, created_at);
create index if not exists crawl_jobs_bot_idx on public.crawl_jobs (bot_id);

-- ============================================================================
-- webhooks idempotency
-- ============================================================================
create table if not exists public.processed_webhooks (
  id           uuid primary key default gen_random_uuid(),
  event_id     text not null unique,
  event_name   text not null,
  payload      jsonb,
  processed_at timestamptz not null default now()
);

create index if not exists processed_webhooks_event_idx on public.processed_webhooks (event_id);

-- ============================================================================
-- match_chunks: vector similarity search
-- ============================================================================
create or replace function public.match_chunks(
  query_embedding vector(384),
  match_bot_id    uuid,
  match_count     int default 6
)
returns table (id uuid, content text, similarity float)
language sql stable
as $$
  select c.id, c.content, 1 - (c.embedding <=> query_embedding) as similarity
  from public.chunks c
  where c.bot_id = match_bot_id
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

-- ============================================================================
-- consume_message_quota
-- ============================================================================
create or replace function public.consume_message_quota(p_bot_id uuid)
returns table(allowed boolean, remaining int, plan text)
language plpgsql
as $$
declare
  b record;
  plan_limit int;
begin
  select * into b from public.bots where id = p_bot_id for update;
  if not found then
    return query select false, 0, 'unknown'::text;
    return;
  end if;

  if b.monthly_message_period_start < date_trunc('month', now()) then
    update public.bots
      set monthly_message_count = 0,
          monthly_message_period_start = date_trunc('month', now()),
          quota_alert_sent = ''
      where id = p_bot_id;
    b.monthly_message_count := 0;
    b.quota_alert_sent := '';
  end if;

  plan_limit := case b.plan
    when 'free' then 500
    when 'starter' then 5000
    when 'pro' then 25000
    else 500
  end;

  if b.monthly_message_count >= plan_limit then
    return query select false, 0, b.plan;
    return;
  end if;

  update public.bots set monthly_message_count = monthly_message_count + 1 where id = p_bot_id;
  return query select true, plan_limit - (b.monthly_message_count + 1), b.plan;
end;
$$;
