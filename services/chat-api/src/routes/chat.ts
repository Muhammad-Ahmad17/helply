import { streamText, type ModelMessage } from "ai";
import { groq } from "@ai-sdk/groq";
import { z } from "zod";
import type { Context } from "hono";
import { createServiceClient } from "@ragify/core/supabase/service";
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

function assertChatEnv(): string | null {
  if (!process.env.GROQ_API_KEY) return "GROQ_API_KEY is not set on the server.";
  if (!process.env.JINA_API_KEY) return "JINA_API_KEY is not set on the server.";
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return "SUPABASE_SERVICE_ROLE_KEY is not set on the server.";
  }
  return null;
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

async function fetchRagContext(
  supabase: ReturnType<typeof createServiceClient>,
  botId: string,
  query: string
): Promise<string> {
  const queryVec = await embedQueryWithTimeout(query, RAG_TIMEOUT_MS);
  if (!queryVec) {
    log({ level: "warn", msg: "rag_embed_timeout", bot_id: botId });
    return "";
  }

  const { data: matches, error } = await supabase.rpc("match_chunks", {
    query_embedding: queryVec,
    match_bot_id: botId,
    match_count: 4,
  });

  if (error) {
    logError("match_chunks_failed", error, { bot_id: botId });
    return "";
  }

  if (!matches?.length) return "";

  return matches
    .map(
      (m: { content: string; similarity: number }, i: number) =>
        `[Source ${i + 1}] (relevance ${m.similarity.toFixed(2)})\n${m.content}`
    )
    .join("\n\n---\n\n");
}

function buildSystemPrompt(base: string, context: string): string {
  if (!context) {
    return `${base}

You have no relevant context for this query. Tell the user that you don't have information on that topic and suggest they ask something else, or contact the site owner directly.`;
  }

  return `${base}

You will be given excerpts from the site below. Use them as your ONLY source of truth.
- If the answer isn't in the excerpts, say so honestly. Do not invent facts.
- Cite sources inline as [Source 1], [Source 2], etc.
- Keep answers concise (2-4 short paragraphs max) unless asked for more detail.

---
CONTEXT:
${context}
---`;
}

async function logConversation(
  botId: string,
  visitorId: string,
  ipHash: string,
  userMessage: string,
  assistantMessage: string
) {
  try {
    const supabase = createServiceClient();
    const { data: conv } = await supabase
      .from("conversations")
      .select("id")
      .eq("bot_id", botId)
      .eq("visitor_id", visitorId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let convId = conv?.id;
    if (!convId) {
      let { data: created, error } = await supabase
        .from("conversations")
        .insert({ bot_id: botId, visitor_id: visitorId, ip_hash: ipHash })
        .select("id")
        .single();

      if (error?.message.includes("ip_hash")) {
        ({ data: created } = await supabase
          .from("conversations")
          .insert({ bot_id: botId, visitor_id: visitorId })
          .select("id")
          .single());
      }
      convId = created?.id;
    }
    if (!convId) return;

    await supabase.from("messages").insert([
      { conversation_id: convId, role: "user", content: userMessage },
      { conversation_id: convId, role: "assistant", content: assistantMessage },
    ]);
  } catch (err) {
    logError("conversation_log_failed", err, { bot_id: botId });
  }
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
    const envError = assertChatEnv();
    if (envError) {
      return c.json({ error: envError }, 500, corsHeaders(origin));
    }

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

    const supabase = createServiceClient();
    const { data: bot, error: botError } = await supabase
      .from("bots")
      .select("*")
      .eq("id", botId)
      .maybeSingle();

    if (botError || !bot) {
      return c.json(
        { error: botError?.message ?? "Bot not found" },
        botError ? 500 : 404,
        corsHeaders(origin)
      );
    }

    const allowedOrigins = (bot as { allowed_origins?: string[] }).allowed_origins ?? [];
    const { allowed, matchedOrigin } = originMatchesAllowlist(origin, referer, allowedOrigins);
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
      // fail open
    }
    if (!rateOk) {
      return c.json({ error: "Too many requests" }, 429, corsHeaders(matchedOrigin));
    }

    const { data: quotaRows, error: quotaError } = await supabase.rpc(
      "consume_message_quota",
      { p_bot_id: botId }
    );
    if (quotaError) {
      logError("quota_check_failed", quotaError, { bot_id: botId });
    }
    const quota = quotaRows?.[0] as { allowed: boolean } | undefined;
    if (quota && !quota.allowed) {
      return c.text(
        "This chatbot has reached its monthly message limit. Please contact the site owner.",
        200,
        {
          ...corsHeaders(matchedOrigin),
          "Content-Type": "text/plain; charset=utf-8",
        }
      );
    }

    const visitorId = signVisitorId(botId, ip, userAgent);
    const ipHash = hashIp(ip);
    const systemPromptBase = bot.system_prompt as string;
    const llmMessages = messages as ModelMessage[];
    const cors = corsHeaders(matchedOrigin);

    const encoder = new TextEncoder();
    const body = new ReadableStream({
      async start(controller) {
        controller.enqueue(encoder.encode(""));
        try {
          const context = await fetchRagContext(supabase, botId, latestUser.content);
          const systemPrompt = buildSystemPrompt(systemPromptBase, context);

          const result = streamText({
            model: groq(GROQ_MODEL),
            system: systemPrompt,
            messages: llmMessages,
            temperature: 0.3,
            maxOutputTokens: MAX_LLM_TOKENS,
          });

          let fullText = "";
          for await (const chunk of result.textStream) {
            fullText += chunk;
            controller.enqueue(encoder.encode(chunk));
          }
          controller.close();

          log({ msg: "chat_done", bot_id: botId, chars: fullText.length });
          void logConversation(botId, visitorId, ipHash, latestUser.content, fullText);
        } catch (err) {
          logError("chat_stream_failed", err, { bot_id: botId });
          controller.enqueue(
            encoder.encode("Sorry, that took too long. Please try a shorter question.")
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

export async function botPublicGet(c: Context) {
  try {
    const botId = c.req.param("botId");
    const supabase = createServiceClient();
    const { data: bot, error } = await supabase
      .from("bots")
      .select("id, name, welcome_message, primary_color")
      .eq("id", botId)
      .maybeSingle();

    if (error) {
      logError("bot_public_get_failed", error, { bot_id: botId });
      return c.json({ error: "Failed to load bot" }, 500);
    }
    if (!bot) return c.json({ error: "Bot not found" }, 404);
    return c.json(bot);
  } catch (err) {
    logError("bot_public_get_unhandled", err);
    const message = err instanceof Error ? err.message : "Internal Server Error";
    return c.json({ error: message }, 500);
  }
}
