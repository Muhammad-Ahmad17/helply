# LEARN.md — modern AI-native stack, explained as it appears in this repo

You said you know the classical stack and the AI concepts in theory. This file walks you through the *modern* pieces you'll touch in this codebase, with pointers to the exact files where each one is used.

Read this top-to-bottom once. Then come back to each section when you actually edit the relevant file.

---

## 1. Next.js App Router (vs Pages Router)

### What changed

Classical Next.js (Pages Router): every file in `pages/` is a route. All components ship to the browser. Data fetching uses `getServerSideProps` / `getStaticProps`.

Modern Next.js (App Router): every folder in `app/` is a route segment. Components are **Server Components by default** — they run on the server, never ship JS to the browser, and can `await` data directly. You opt **into** client-side behavior with `"use client"` at the top of a file.

### Why it matters

A page like [`src/app/dashboard/page.tsx`](src/app/dashboard/page.tsx) can `await supabase.from("bots").select(...)` directly in the component body. No API route, no `useEffect`, no loading flicker. The DB query runs on the server, the HTML arrives with the data already baked in.

### Files to study

- [`src/app/dashboard/page.tsx`](src/app/dashboard/page.tsx) — Server Component (no `"use client"`), `await`s Supabase
- [`src/app/dashboard/bots/[id]/bot-detail.tsx`](src/app/dashboard/bots/%5Bid%5D/bot-detail.tsx) — Client Component (has `"use client"`), uses `useState`

### Rule of thumb

- Need to fetch data? → Server Component.
- Need state, effects, browser APIs, event handlers? → Client Component.
- Server Components can import Client Components. The other way around requires the import to be deferred.

---

## 2. Server Actions (the modern replacement for handwritten POST endpoints)

### What it is

A Server Action is a function annotated with `"use server"`. It runs only on the server but you can call it directly from a Client Component or from a `<form action={...}>`. Next.js handles the HTTP round-trip for you.

### Why it replaces REST

For internal CRUD ("create a bot", "update settings", "log the user out") you don't need to write a route handler + a fetch call + JSON serialization. The Server Action *is* the endpoint, with type-safe arguments.

### Where to see it

[`src/app/dashboard/actions.ts`](src/app/dashboard/actions.ts) — `createBot`, `updateBot`, `deleteBot`, `logout` are all Server Actions. They're called from:

- HTML forms: `<form action={logout}>`
- Client Components: `await createBot(formData)` from inside `useTransition`

### Important

Anything in a `"use server"` file becomes a public POST endpoint. **Validate inputs** (we use Zod) and **check auth** (we call `supabase.auth.getUser()` inside every action that mutates).

---

## 3. Supabase + Row-Level Security (vs classical Postgres roles)

### Classical model

You had one app DB user, the app code enforced "user X can only see their own rows" in WHERE clauses. Easy to forget → security bugs.

### Modern model

Postgres + RLS policies. The DB itself enforces the rules. Every query carries the user's JWT, and policies say "the row is visible if `auth.uid() = owner_id`".

### Where to see it

[`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql) — the `enable row level security` block + `create policy` statements. We have three flavors of Supabase client:

- [`src/lib/supabase/client.ts`](src/lib/supabase/client.ts) — runs in the browser, anon key, RLS enforced as the logged-in user.
- [`src/lib/supabase/server.ts`](src/lib/supabase/server.ts) — runs in Server Components / Route Handlers / Server Actions, reads the auth cookie, RLS enforced.
- [`src/lib/supabase/service.ts`](src/lib/supabase/service.ts) — service role key, **bypasses RLS**. Use only on the server, only when you have a reason (e.g., logging anonymous-visitor chat traffic).

### Mental model

> Code can be wrong. The DB can't.

Putting policies in the DB means even if your route handler forgets a check, nothing leaks.

---

## 4. pgvector + HNSW (vector search in plain SQL)

### What it is

`pgvector` is a Postgres extension that adds a `vector(N)` column type and three distance operators: `<->` (Euclidean), `<#>` (negative dot product), `<=>` (cosine).

### What HNSW is

Brute-force nearest-neighbor on a million rows is too slow. HNSW (Hierarchical Navigable Small World) is an *approximate* nearest-neighbor index. Tradeoff: slightly less accurate (95-99% recall) but 100-1000x faster.

### Where to see it

[`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql):

```sql
embedding vector(1024) not null
...
create index chunks_embedding_idx on public.chunks using hnsw (embedding vector_cosine_ops);
```

And the `match_chunks` SQL function — the vector search runs *in the DB*, returns ranked rows. You don't pull all chunks and rank in app code.

### Alternative you'll see in the wild

`IVFFlat` — cheaper to build, slightly slower to query. HNSW is usually the default for production.

---

## 5. The RAG pattern (retrieval-augmented generation)

### The problem RAG solves

LLMs hallucinate when asked about content they haven't seen. They also have a token-limit on prompt size. You can't paste a 100-page docs site into a prompt.

### The RAG pattern in three steps

1. **Index time**: chunk your content (~500 tokens each), embed each chunk into a vector, store in pgvector.
2. **Query time**: embed the user's question, find the top-K most similar chunks via cosine similarity.
3. **Generation**: paste those K chunks into the LLM prompt as "context", ask the LLM to answer using only that context.

### Where to see it

- Index: [`src/app/api/crawl/route.ts`](src/app/api/crawl/route.ts) — fetches a URL, calls `chunkText`, calls `embedPassages`, inserts.
- Query: [`src/app/api/chat/route.ts`](src/app/api/chat/route.ts) — calls `embedQuery`, calls `match_chunks` RPC, injects results into the system prompt.

### Quality knobs

- **Chunk size**: too small = lost context, too big = noisy. 300-800 tokens is the sweet spot for most use cases. See [`src/lib/ai/chunk.ts`](src/lib/ai/chunk.ts).
- **Overlap**: chunks share ~50 tokens with neighbors so info at boundaries isn't lost.
- **Task-specific embeddings**: Jina v3 (and modern OpenAI embeddings) take a `task` parameter — passages should be embedded as "retrieval.passage", queries as "retrieval.query". 5-15% retrieval quality boost for free.

---

## 6. Streaming responses (vs full-payload responses)

### The classical pattern

Server runs for 10 seconds → returns a 4 KB JSON blob → browser parses → UI updates.

### The modern pattern (LLM-shaped)

LLMs emit tokens one at a time. Streaming means the server starts pushing bytes to the browser as the model generates them. The user sees the answer appear word-by-word — feels 10× faster even when total latency is identical.

### How it works in this repo

[`src/app/api/chat/route.ts`](src/app/api/chat/route.ts):

```ts
const result = streamText({ model: groq("llama-3.3-70b-versatile"), ... });
return result.toTextStreamResponse();
```

`streamText` returns a stream object. `toTextStreamResponse()` wraps it as a standard Web `Response` with a `ReadableStream` body.

On the client, [`src/app/embed/[botId]/chat-ui.tsx`](src/app/embed/%5BbotId%5D/chat-ui.tsx) reads the body via `getReader()` and decodes chunks as they arrive.

### Vercel AI SDK's job

It abstracts the differences between providers. The same `streamText({ model: ... })` call works whether `model` is `groq(...)`, `openai(...)`, `anthropic(...)`. Provider-agnostic.

---

## 7. Edge vs Node runtimes

Next.js routes can run on:

- **Node runtime** (default) — full Node.js APIs, longer cold starts, 60s+ max duration.
- **Edge runtime** — runs on Cloudflare-Worker-like environments. No `fs`, no `crypto.createHash`. Faster cold starts, lower latency, ~30s max duration.

For Helply:
- `/api/crawl` uses **Node** runtime (default) because we need `cheerio` and longer execution.
- `/api/chat` could use Edge, but we keep it on Node for simplicity — also fine.

You opt into Edge with `export const runtime = "edge"`.

---

## 8. Middleware

[`src/middleware.ts`](src/middleware.ts) runs *before* every matching request. We use it for two things:

1. **Auth cookie refresh** — Supabase sessions expire; middleware refreshes them silently.
2. **Route gating** — block `/dashboard` for non-logged-in users, redirect logged-in users away from `/login`.

The classical equivalent is Express middleware. The modern Next.js version runs on the Edge runtime by default (very fast, very cheap).

---

## 9. The embed widget pattern

A widget that any website can drop in needs to be **single line, async, isolated**.

- **Single line**: just one `<script>` tag with a `data-bot` attribute → [`src/app/api/widget.js/route.ts`](src/app/api/widget.js/route.ts) reads it via `document.currentScript`.
- **Async**: `defer` attribute + the script appends DOM after `DOMContentLoaded`.
- **Isolated**: the actual chat UI is rendered inside an `<iframe>` pointing to `/embed/[botId]`. The iframe has its own CSS scope — your host site's styles can't leak in, and your widget styles can't leak out. The iframe communicates back via `window.postMessage`.

This is the same architecture used by Intercom, Crisp, Drift, etc.

---

## 10. Env vars: public vs private

| Prefix | Visible to | Use for |
| --- | --- | --- |
| `NEXT_PUBLIC_*` | browser + server | URLs, anon Supabase key, public IDs |
| `NO PREFIX` | server only | service role key, Groq key, Jina key |

A `NEXT_PUBLIC_*` var is **inlined into the JS bundle at build time**. Anyone can read it in DevTools. Don't put secrets there.

---

## Curated reading list

When you want to go deeper, in priority order:

1. [Next.js App Router docs](https://nextjs.org/docs/app) — the official tutorial covers RSC, Server Actions, and streaming in one pass.
2. [Supabase RLS deep-dive](https://supabase.com/docs/guides/database/postgres/row-level-security) — read this before deploying anything to production.
3. [pgvector README](https://github.com/pgvector/pgvector) — operators, index types, dimension tradeoffs.
4. [Vercel AI SDK docs](https://ai-sdk.dev) — `streamText`, `generateObject`, tools/agents API.
5. [Jina AI embeddings docs](https://jina.ai/embeddings) — task types, dimension reduction, multilingual support.

---

## Concept-to-file index (cheat sheet)

| Concept | File |
| --- | --- |
| Server Component fetching data | `src/app/dashboard/page.tsx` |
| Client Component with state | `src/app/dashboard/bots/[id]/bot-detail.tsx` |
| Server Action | `src/app/dashboard/actions.ts` |
| Auth cookie middleware | `src/middleware.ts` |
| Magic-link signin | `src/app/login/page.tsx` |
| RLS policies | `supabase/migrations/0001_init.sql` |
| pgvector HNSW index | `supabase/migrations/0001_init.sql` |
| RAG ingest pipeline | `src/app/api/crawl/route.ts` |
| RAG query pipeline | `src/app/api/chat/route.ts` |
| Streaming LLM response | `src/app/api/chat/route.ts` |
| Embed loader script | `src/app/api/widget.js/route.ts` |
| Iframe chat UI | `src/app/embed/[botId]/chat-ui.tsx` |
| Text chunking | `src/lib/ai/chunk.ts` |
| Task-typed embeddings | `src/lib/ai/embeddings.ts` |
| Cheerio-based crawler | `src/lib/crawler.ts` |
