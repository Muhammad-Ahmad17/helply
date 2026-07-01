-- Text and PDF context sources (in addition to URL crawl)

create type source_kind as enum ('url', 'text', 'pdf');

alter table public.sources
  add column if not exists kind source_kind not null default 'url',
  add column if not exists raw_content text;

create index if not exists sources_kind_idx on public.sources (bot_id, kind);
