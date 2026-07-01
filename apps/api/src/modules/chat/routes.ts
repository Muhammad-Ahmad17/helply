import { streamText } from "ai";
import type { CoreMessage } from "ai";
import { groq } from "@ai-sdk/groq";
import { z } from "zod";
import type { Context } from "hono";
import { getUserFromBearer } from "@ragify/core/auth";
import {
  getBotById,
  getBotForOwner,
  consumeMessageQuota,
  matchChunksEnriched,
  logConversation,
} from "@ragify/core/db";
import { embedQueryWithTimeout } from "@ragify/core/ai/embeddings";
import { chatLimiter, checkRateLimit } from "@ragify/core/rate-limit";
import {
  getClientIp,
  hashIp,
  signVisitorId,
  originMatchesAllowlist,
} from "@ragify/core/security";
import { log, logError } from "@ragify/core/log";

const GROQ_MODEL = process.env.GROQ_MODEL ?? "llama-3.1-8b-instant";
const RAG_TIMEOUT_MS = 3500;
const MAX_LLM_TOKENS = 512;
const RAG_MATCH_COUNT = 8;

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

const bodySchema = z.object({
  botId: z.string().uuid(),
  visitorId: z.string().min(1).max(64).optional(),
  messages: z.array(messageSchema).min(1).max(20),
});

function corsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
  if (origin) {
    headers["Access-Control-Allow-Origin"] = origin;
    headers["Vary"] = "Origin";
  }
  return headers;
}

function sanitizeMessages(messages: { role: string; content: string }[]) {
  return messages
    .filter(
      (m) =>
        m.content.trim().length > 0 &&
        !m.content.startsWith("Something went wrong")
    )
    .slice(-8);
}

function sourceKindLabel(kind: string): string {
  if (kind === "text") return "Text";
  if (kind === "pdf") return "PDF";
  return "URL";
}

function buildRetrievalQuery(
  messages: { role: string; content: string }[],
  latestUser: string
): string {
  const recentUser = messages
    .filter((m) => m.role === "user")
    .slice(-2)
    .map((m) => m.content.trim())
    .filter(Boolean);
  const combined = [...new Set(recentUser)].join("\n");
  return combined || latestUser;
}

async function fetchRagContext(botId: string, query: string): Promise<string> {
  const queryVec = await embedQueryWithTimeout(query, RAG_TIMEOUT_MS);
  if (!queryVec) {
    log({ level: "warn", msg: "rag_embed_timeout", bot_id: botId });
    return "";
  }

  try {
    const matches = await matchChunksEnriched(botId, queryVec, RAG_MATCH_COUNT);
    if (!matches.length) return "";
    return matches
      .map((m, i) => {
        const label = `${sourceKindLabel(m.source_kind)}: ${m.source_label}`;
        return `[Source ${i + 1} — ${label}] (relevance ${m.similarity.toFixed(2)})\n${m.content}`;
      })
      .join("\n\n---\n\n");
  } catch (err) {
    logError("match_chunks_failed", err, { bot_id: botId });
    return "";
  }
}

function buildSystemPrompt(base: string, context: string): string {
  const synthesisRules = `
When answering:
- Synthesize facts across ALL excerpts before responding — information may be split across sources.
- Treat names, nicknames, initials, and partial references as the SAME entity when context supports it (e.g. "Muhammad Ahmad", "Ahmad", and "Muhammad" on a GitHub profile are one person).
- Do NOT invent separate people or contradict yourself by treating aliases as different individuals.
- Prefer the most specific and recent detail when excerpts agree they refer to the same subject.
- Cite sources inline as [Source 1], [Source 2], etc.
- Keep answers concise (2-4 short paragraphs) unless asked for more detail.`;

  if (!context) {
    return `${base}

You have no relevant context for this query. Tell the user that you don't have information on that topic and suggest they ask something else, or contact the site owner directly.`;
  }
  return `${base}

You will be given excerpts from the owner's knowledge base below. Use them as your ONLY source of truth.
- If the answer isn't in the excerpts, say so honestly. Do not invent facts.
${synthesisRules}

---
CONTEXT:
${context}
---`;
}

export async function chatOptions(c: Context) {
  const origin = c.req.header("origin") ?? null;
  return c.body(null, 204, corsHeaders(origin));
}

export async function chatPost(c: Context) {
  const origin = c.req.header("origin") ?? null;
  const referer = c.req.header("referer") ?? null;
  const ip = getClientIp(c.req.raw);
  const userAgent = c.req.header("user-agent") ?? null;

  try {
    const rawBody = await c.req.text();
    const parsed = bodySchema.safeParse(JSON.parse(rawBody || "{}"));
    if (!parsed.success) {
      return c.json({ error: "Invalid request body" }, 400, corsHeaders(origin));
    }

    const { botId, messages: rawMessages } = parsed.data;
    const messages = sanitizeMessages(rawMessages);
    if (messages.length === 0) {
      return c.json({ error: "No valid messages" }, 400, corsHeaders(origin));
    }

    const latestUser = [...messages].reverse().find((m) => m.role === "user");
    if (!latestUser) {
      return c.json({ error: "No user message" }, 400, corsHeaders(origin));
    }

    const bot = await getBotById(botId);
    if (!bot) return c.json({ error: "Bot not found" }, 404, corsHeaders(origin));

    const allowedOrigins = bot.allowed_origins ?? [];
    const { allowed, matchedOrigin } = originMatchesAllowlist(
      origin,
      referer,
      allowedOrigins
    );
    if (!allowed) {
      return c.json(
        { error: "Origin not allowed. Add this domain in bot Settings." },
        403,
        corsHeaders(null)
      );
    }

    let rateOk = true;
    try {
      const rate = await checkRateLimit(chatLimiter, `${botId}:${ip}`);
      rateOk = rate.success;
    } catch {
      /* fail open */
    }
    if (!rateOk) {
      return c.json({ error: "Too many requests" }, 429, corsHeaders(matchedOrigin));
    }

    try {
      const quota = await consumeMessageQuota(botId);
      if (!quota.allowed) {
        return c.text(
          "This chatbot has reached its monthly message limit. Please contact the site owner.",
          200,
          {
            ...corsHeaders(matchedOrigin),
            "Content-Type": "text/plain; charset=utf-8",
          }
        );
      }
    } catch (err) {
      logError("quota_check_failed", err, { bot_id: botId });
    }

    const visitorId = signVisitorId(botId, ip, userAgent);
    const ipHash = hashIp(ip);
    const llmMessages = messages as CoreMessage[];
    const cors = corsHeaders(matchedOrigin);

    const encoder = new TextEncoder();
    const body = new ReadableStream({
      async start(controller) {
        controller.enqueue(encoder.encode(""));
        try {
          const retrievalQuery = buildRetrievalQuery(messages, latestUser.content);
          const context = await fetchRagContext(botId, retrievalQuery);
          const systemPrompt = buildSystemPrompt(bot.system_prompt, context);

          const result = streamText({
            model: groq(GROQ_MODEL),
            system: systemPrompt,
            messages: llmMessages,
            temperature: 0.3,
            maxTokens: MAX_LLM_TOKENS,
          });

          let fullText = "";
          for await (const chunk of result.textStream) {
            fullText += chunk;
            controller.enqueue(encoder.encode(chunk));
          }
          controller.close();

          log({ msg: "chat_done", bot_id: botId, chars: fullText.length });
          void logConversation(
            botId,
            visitorId,
            ipHash,
            latestUser.content,
            fullText
          );
        } catch (err) {
          logError("chat_stream_failed", err, { bot_id: botId });
          controller.enqueue(
            encoder.encode(
              "Sorry, that took too long. Please try a shorter question."
            )
          );
          controller.close();
        }
      },
    });

    return new Response(body, {
      headers: {
        ...cors,
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    logError("chat_unhandled", err);
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: message }, 500, corsHeaders(origin));
  }
}

export async function botGet(c: Context) {
  try {
    const botId = c.req.param("botId") ?? "";
    const user = await getUserFromBearer(c.req.header("authorization"));

    if (user) {
      const owned = await getBotForOwner(botId, user.id);
      if (owned) return c.json({ bot: owned });
    }

    const bot = await getBotById(botId);
    if (!bot) return c.json({ error: "Bot not found" }, 404);
    return c.json({
      id: bot.id,
      name: bot.name,
      welcome_message: bot.welcome_message,
      primary_color: bot.primary_color,
    });
  } catch (err) {
    logError("bot_get_unhandled", err);
    return c.json({ error: "Internal Server Error" }, 500);
  }
}
