-- Phase 2/4: Lemon Squeezy webhook idempotency + admin flag

-- Webhook idempotency log — service-role only (no client access)
create table if not exists public.processed_webhooks (
  id           uuid primary key default gen_random_uuid(),
  event_id     text not null unique,
  event_name   text not null,
  payload      jsonb,
  processed_at timestamptz not null default now()
);

create index if not exists processed_webhooks_event_idx on public.processed_webhooks (event_id);

alter table public.processed_webhooks enable row level security;
-- Intentionally no policies: anon/authenticated cannot read or write.
-- Only the service-role client (server webhook handler) bypasses RLS.

-- Per-user plan (plans are per account, not per bot)
create table if not exists public.user_profiles (
  user_id               uuid primary key references auth.users(id) on delete cascade,
  plan                  text not null default 'free' check (plan in ('free','starter','pro')),
  is_admin              boolean not null default false,
  lemon_customer_id     text,
  lemon_subscription_id text,
  updated_at            timestamptz not null default now()
);

alter table public.user_profiles enable row level security;

create policy "users read own profile"
  on public.user_profiles for select
  using (auth.uid() = user_id);

create policy "users update own profile"
  on public.user_profiles for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.user_profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

-- Idempotent trigger setup (avoids DROP if trigger already exists)
do $$
begin
  if not exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where t.tgname = 'on_auth_user_created'
      and n.nspname = 'auth'
      and c.relname = 'users'
  ) then
    create trigger on_auth_user_created
      after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;
end;
$$;

-- Backfill profiles for users who signed up before this migration
insert into public.user_profiles (user_id)
select id from auth.users
on conflict (user_id) do nothing;
