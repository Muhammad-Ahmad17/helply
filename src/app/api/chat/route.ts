// POST /api/chat
import { streamText, type ModelMessage } from "ai";
import { groq } from "@ai-sdk/groq";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { embedQuery } from "@/lib/ai/embeddings";
import { chatLimiter, checkRateLimit } from "@/lib/rate-limit";
import {
  getClientIp,
  hashIp,
  signVisitorId,
  originMatchesAllowlist,
} from "@/lib/security";
import { log, logError } from "@/lib/log";
import { maybeSendQuotaAlert } from "@/lib/quota-alerts";

export const maxDuration = 30;

const MAX_PAYLOAD_BYTES = 32 * 1024;

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
  if (!process.env.GROQ_API_KEY) {
    return "GROQ_API_KEY is not set on the server.";
  }
  if (!process.env.JINA_API_KEY) {
    return "JINA_API_KEY is not set on the server.";
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return "SUPABASE_SERVICE_ROLE_KEY is not set on the server.";
  }
  return null;
}

/** Drop empty/error placeholder turns before sending to the LLM. */
function sanitizeMessages(messages: { role: string; content: string }[]) {
  return messages.filter(
    (m) =>
      m.content.trim().length > 0 &&
      !m.content.startsWith("Something went wrong")
  );
}

export async function OPTIONS(req: Request) {
  const origin = req.headers.get("origin");
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

export async function POST(req: Request) {
  const start = Date.now();
  const ip = getClientIp(req);
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const userAgent = req.headers.get("user-agent");

  try {
    const envError = assertChatEnv();
    if (envError) {
      return Response.json({ error: envError }, { status: 500, headers: corsHeaders(origin) });
    }

    const rawBody = await req.text();
    if (rawBody.length > MAX_PAYLOAD_BYTES) {
      return Response.json(
        { error: "Payload too large" },
        { status: 413, headers: corsHeaders(origin) }
      );
    }

    let json: unknown;
    try {
      json = JSON.parse(rawBody);
    } catch {
      return Response.json(
        { error: "Invalid JSON" },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid request body" },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    const { botId, messages: rawMessages } = parsed.data;
    const messages = sanitizeMessages(rawMessages);

    if (messages.length === 0) {
      return Response.json(
        { error: "No valid messages" },
        { status: 400, headers: corsHeaders(origin) }
      );
    }

    const supabase = createServiceClient();

    const { data: bot, error: botError } = await supabase
      .from("bots")
      .select("*")
      .eq("id", botId)
      .maybeSingle();

    if (botError) {
      logError("chat_bot_lookup_failed", botError, { bot_id: botId });
      return Response.json(
        { error: botError.message },
        { status: 500, headers: corsHeaders(origin) }
      );
    }

    if (!bot) {
      return Response.json(
        { error: "Bot not found" },
        { status: 404, headers: corsHeaders(origin) }
      );
    }

    const allowedOrigins = (bot as { allowed_origins?: string[] }).allowed_origins ?? [];
    const { allowed, matchedOrigin } = originMatchesAllowlist(
      origin,
      referer,
      allowedOrigins
    );

    if (!allowed) {
      log({ level: "warn", msg: "origin_blocked", bot_id: botId, origin, referer });
      return Response.json(
        { error: "Origin not allowed. Add this domain in bot Settings → Allowed domains." },
        { status: 403, headers: corsHeaders(null) }
      );
    }

    const rateKey = `${botId}:${ip}`;
    let rate;
    try {
      rate = await checkRateLimit(chatLimiter, rateKey);
    } catch {
      rate = { success: true, limit: 999, remaining: 999, reset: Date.now() + 60_000 };
    }

    if (!rate.success) {
      const retryAfter = Math.max(1, Math.ceil((rate.reset - Date.now()) / 1000));
      return Response.json(
        { error: "Too many requests" },
        {
          status: 429,
          headers: {
            ...corsHeaders(matchedOrigin),
            "Retry-After": String(retryAfter),
          },
        }
      );
    }

    const visitorId = signVisitorId(botId, ip, userAgent);
    const ipHash = hashIp(ip);

    const { data: quotaRows, error: quotaError } = await supabase.rpc(
      "consume_message_quota",
      { p_bot_id: botId }
    );

    if (quotaError) {
      // Quota RPC missing or broken — log but don't block chat
      logError("quota_check_failed", quotaError, { bot_id: botId });
    }

    const quota = quotaRows?.[0] as
      | { allowed: boolean; remaining: number; plan: string }
      | undefined;

    if (quota && !quota.allowed) {
      void maybeSendQuotaAlert(botId, quota.plan, 0);
      return new Response(
        "This chatbot has reached its monthly message limit. The site owner has been notified.",
        {
          status: 200,
          headers: {
            ...corsHeaders(matchedOrigin),
            "Content-Type": "text/plain; charset=utf-8",
          },
        }
      );
    }

    if (quota?.allowed) {
      void maybeSendQuotaAlert(botId, quota.plan, quota.remaining);
    }

    const latestUser = [...messages].reverse().find((m) => m.role === "user");
    if (!latestUser) {
      return Response.json(
        { error: "No user message provided" },
        { status: 400, headers: corsHeaders(matchedOrigin) }
      );
    }

    let context = "";
    try {
      const queryVec = await embedQuery(latestUser.content);
      const { data: matches, error: matchError } = await supabase.rpc("match_chunks", {
        query_embedding: queryVec,
        match_bot_id: botId,
        match_count: 6,
      });

      if (matchError) {
        logError("match_chunks_failed", matchError, { bot_id: botId });
      } else if (matches && matches.length > 0) {
        context = matches
          .map(
            (m: { content: string; similarity: number }, i: number) =>
              `[Source ${i + 1}] (relevance ${m.similarity.toFixed(2)})\n${m.content}`
          )
          .join("\n\n---\n\n");
      }
    } catch (err) {
      logError("rag_retrieval_failed", err, { bot_id: botId });
    }

    const systemPrompt = buildSystemPrompt(bot.system_prompt, context);

    const result = streamText({
      model: groq("llama-3.3-70b-versatile"),
      system: systemPrompt,
      messages: messages as ModelMessage[],
      temperature: 0.3,
      onFinish: async ({ text }) => {
        try {
          await logConversation(botId, visitorId, ipHash, latestUser.content, text);
        } catch (err) {
          logError("conversation_log_failed", err, { bot_id: botId });
        }
      },
    });

    log({
      msg: "chat_request",
      bot_id: botId,
      latency_ms: Date.now() - start,
    });

    const response = result.toTextStreamResponse();
    const headers = new Headers(response.headers);
    for (const [k, v] of Object.entries(corsHeaders(matchedOrigin))) {
      headers.set(k, v);
    }
    return new Response(response.body, { status: response.status, headers });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logError("chat_unhandled", err, { bot_id: "unknown" });
    return Response.json(
      { error: message },
      { status: 500, headers: corsHeaders(origin) }
    );
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
}
