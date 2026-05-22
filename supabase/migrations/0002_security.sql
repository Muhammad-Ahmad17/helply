-- Phase 1: security columns for origin allowlist and future quota tracking
alter table public.bots
  add column if not exists allowed_origins text[] not null default '{}',
  add column if not exists plan text not null default 'free' check (plan in ('free','starter','pro')),
  add column if not exists monthly_message_count int not null default 0,
  add column if not exists monthly_message_period_start timestamptz not null default date_trunc('month', now());

create index if not exists bots_plan_idx on public.bots (plan);

alter table public.conversations
  add column if not exists ip_hash text;
