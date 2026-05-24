// POST /api/chat — streams immediately to avoid Vercel Hobby 10s gateway timeout.
import { streamText, type ModelMessage } from "ai";
import { groq } from "@ai-sdk/groq";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { embedQueryWithTimeout } from "@/lib/ai/embeddings";
import { chatLimiter, checkRateLimit } from "@/lib/rate-limit";
import {
  getClientIp,
  hashIp,
  signVisitorId,
  originMatchesAllowlist,
} from "@/lib/security";
import { log, logError } from "@/lib/log";

// Self-hosted: no Vercel cap. Vercel Hobby still caps at 10s regardless.
export const maxDuration = 60;

const GROQ_MODEL =
  process.env.GROQ_MODEL ?? "llama-3.1-8b-instant";

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

function corsHeaders(origin: string | null): HeadersInit {
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

export async function OPTIONS(req: Request) {
  const origin = req.headers.get("origin");
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

export async function POST(req: Request) {
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const ip = getClientIp(req);
  const userAgent = req.headers.get("user-agent");

  try {
    const envError = assertChatEnv();
    if (envError) {
      return Response.json({ error: envError }, { status: 500, headers: corsHeaders(origin) });
    }

    const rawBody = await req.text();
    const parsed = bodySchema.safeParse(JSON.parse(rawBody || "{}"));
    if (!parsed.success) {
      return Response.json({ error: "Invalid request body" }, { status: 400, headers: corsHeaders(origin) });
    }

    const { botId, messages: rawMessages } = parsed.data;
    const messages = sanitizeMessages(rawMessages);
    if (messages.length === 0) {
      return Response.json({ error: "No valid messages" }, { status: 400, headers: corsHeaders(origin) });
    }

    const latestUser = [...messages].reverse().find((m) => m.role === "user");
    if (!latestUser) {
      return Response.json({ error: "No user message" }, { status: 400, headers: corsHeaders(origin) });
    }

    const supabase = createServiceClient();
    const { data: bot, error: botError } = await supabase
      .from("bots")
      .select("*")
      .eq("id", botId)
      .maybeSingle();

    if (botError || !bot) {
      return Response.json(
        { error: botError?.message ?? "Bot not found" },
        { status: botError ? 500 : 404, headers: corsHeaders(origin) }
      );
    }

    const allowedOrigins = (bot as { allowed_origins?: string[] }).allowed_origins ?? [];
    const { allowed, matchedOrigin } = originMatchesAllowlist(origin, referer, allowedOrigins);
    if (!allowed) {
      return Response.json(
        { error: "Origin not allowed. Add this domain in bot Settings." },
        { status: 403, headers: corsHeaders(null) }
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
      return Response.json({ error: "Too many requests" }, { status: 429, headers: corsHeaders(matchedOrigin) });
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
      return new Response(
        "This chatbot has reached its monthly message limit. Please contact the site owner.",
        {
          status: 200,
          headers: {
            ...Object.fromEntries(Object.entries(corsHeaders(matchedOrigin))),
            "Content-Type": "text/plain; charset=utf-8",
          },
        }
      );
    }

    const visitorId = signVisitorId(botId, ip, userAgent);
    const ipHash = hashIp(ip);

    const systemPromptBase = bot.system_prompt as string;
    const llmMessages = messages as ModelMessage[];

    // Return stream IMMEDIATELY — RAG + Groq run inside (prevents 504 before first byte)
    const encoder = new TextEncoder();
    const cors = corsHeaders(matchedOrigin);

    const body = new ReadableStream({
      async start(controller) {
        // Flush headers immediately so Vercel gateway doesn't 504 while RAG runs
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
        ...Object.fromEntries(Object.entries(cors)),
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logError("chat_unhandled", err);
    return Response.json({ error: message }, { status: 500, headers: corsHeaders(origin) });
  }
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
