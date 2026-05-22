-- Helply initial schema.
-- Paste this whole file into Supabase Dashboard > SQL Editor > New Query > Run.
-- (See README.md "Database setup" for screenshots.)
--
-- Concepts (see LEARN.md for full explanations):
--   pgvector   = Postgres extension that stores vector embeddings and runs cosine similarity in SQL.
--   RLS        = Row-Level Security; we enforce "users can only see their own rows" at the DB layer.
--   auth.users = Supabase's built-in users table; we reference it via owner_id.

create extension if not exists "vector";
create extension if not exists "pgcrypto";

-- ============================================================================
-- bots: one row per chatbot a user creates.
-- ============================================================================
create table if not exists public.bots (
  id              uuid primary key default gen_random_uuid(),
  owner_id        uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  slug            text not null unique,
  welcome_message text not null default 'Hi! Ask me anything about this site.',
  system_prompt   text not null default 'You are a helpful assistant. Answer only using the provided context. If you do not know, say so honestly.',
  primary_color   text not null default '#0ea5e9',
  created_at      timestamptz not null default now()
);

create index if not exists bots_owner_idx on public.bots (owner_id);

-- ============================================================================
-- sources: a URL the bot has ingested (one per page/sitemap entry).
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
-- chunks: a piece of text + its embedding.
-- Jina embeddings v3 produces 1024-dim vectors.
-- ============================================================================
create table if not exists public.chunks (
  id          uuid primary key default gen_random_uuid(),
  bot_id      uuid not null references public.bots(id) on delete cascade,
  source_id   uuid not null references public.sources(id) on delete cascade,
  content     text not null,
  embedding   vector(1024) not null,
  token_count int  not null default 0,
  created_at  timestamptz not null default now()
);

-- HNSW index for fast approximate nearest neighbor search.
-- Cosine distance is the default for sentence embeddings.
create index if not exists chunks_embedding_idx
  on public.chunks
  using hnsw (embedding vector_cosine_ops);

create index if not exists chunks_bot_idx on public.chunks (bot_id);

-- ============================================================================
-- conversations + messages: stored chat history (helps debugging + analytics).
-- ============================================================================
create table if not exists public.conversations (
  id          uuid primary key default gen_random_uuid(),
  bot_id      uuid not null references public.bots(id) on delete cascade,
  visitor_id  text not null,
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
-- match_chunks: SQL function called by /api/chat for vector similarity search.
-- ============================================================================
create or replace function public.match_chunks(
  query_embedding vector(1024),
  match_bot_id    uuid,
  match_count     int default 6
)
returns table (
  id        uuid,
  content   text,
  similarity float
)
language sql stable
as $$
  select
    c.id,
    c.content,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.chunks c
  where c.bot_id = match_bot_id
  order by c.embedding <=> query_embedding
  limit match_count;
$$;

-- ============================================================================
-- Row-Level Security
-- ============================================================================
alter table public.bots          enable row level security;
alter table public.sources       enable row level security;
alter table public.chunks        enable row level security;
alter table public.conversations enable row level security;
alter table public.messages      enable row level security;

-- bots: owner full access.
create policy "owners manage bots"
  on public.bots for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- sources: owner full access (joined via bot).
create policy "owners manage sources"
  on public.sources for all
  using (exists (
    select 1 from public.bots b where b.id = sources.bot_id and b.owner_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.bots b where b.id = sources.bot_id and b.owner_id = auth.uid()
  ));

-- chunks: owner read-only via dashboard. Writes happen via service role (server).
create policy "owners read chunks"
  on public.chunks for select
  using (exists (
    select 1 from public.bots b where b.id = chunks.bot_id and b.owner_id = auth.uid()
  ));

-- conversations + messages: owner read-only. Writes happen via service role.
create policy "owners read conversations"
  on public.conversations for select
  using (exists (
    select 1 from public.bots b where b.id = conversations.bot_id and b.owner_id = auth.uid()
  ));

create policy "owners read messages"
  on public.messages for select
  using (exists (
    select 1 from public.conversations c
    join public.bots b on b.id = c.bot_id
    where c.id = messages.conversation_id and b.owner_id = auth.uid()
  ));
