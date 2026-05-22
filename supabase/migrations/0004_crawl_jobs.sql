-- Phase 3: background crawl job queue
create type crawl_job_status as enum ('pending', 'running', 'done', 'error');

create table if not exists public.crawl_jobs (
  id           uuid primary key default gen_random_uuid(),
  bot_id       uuid not null references public.bots(id) on delete cascade,
  source_id    uuid references public.sources(id) on delete cascade,
  url          text not null,
  status       crawl_job_status not null default 'pending',
  attempts     int not null default 0,
  last_error   text,
  created_at   timestamptz not null default now(),
  started_at   timestamptz,
  finished_at  timestamptz
);

create index if not exists crawl_jobs_status_idx on public.crawl_jobs (status, created_at);
create index if not exists crawl_jobs_bot_idx on public.crawl_jobs (bot_id);

alter table public.crawl_jobs enable row level security;

create policy "owners read crawl_jobs"
  on public.crawl_jobs for select
  using (exists (
    select 1 from public.bots b where b.id = crawl_jobs.bot_id and b.owner_id = auth.uid()
  ));

-- Claim pending jobs safely across concurrent workers
create or replace function public.claim_crawl_jobs(p_limit int default 5)
returns setof public.crawl_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.crawl_jobs
    set status = 'running',
        started_at = now(),
        attempts = attempts + 1
  where id in (
    select id from public.crawl_jobs
    where status = 'pending'
    order by created_at asc
    limit p_limit
    for update skip locked
  )
  returning *;
end;
$$;

grant execute on function public.claim_crawl_jobs(int) to service_role;
