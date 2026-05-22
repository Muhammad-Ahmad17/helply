// POST /api/chat
// Public, CORS-enabled streaming chat endpoint. Called by the embed widget.
//
// Flow:
//   1. Validate body (botId + messages).
//   2. Embed the latest user message.
//   3. Vector-search chunks from this bot.
//   4. Build the RAG system prompt with retrieved context.
//   5. Stream the Groq Llama 3.3 70B response back as plain text.
//   6. Log the conversation in the background (doesn't block the stream).
import { streamText, type ModelMessage } from "ai";
import { groq } from "@ai-sdk/groq";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { embedQuery } from "@/lib/ai/embeddings";

export const maxDuration = 30;

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(4000),
});

const bodySchema = z.object({
  botId: z.string().uuid(),
  visitorId: z.string().min(1).max(64),
  messages: z.array(messageSchema).min(1).max(20),
});

export async function OPTIONS() {
  return new Response(null, { status: 204 });
}

export async function POST(req: Request) {
  const json = await req.json().catch(() => null);
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { botId, visitorId, messages } = parsed.data;
  const supabase = createServiceClient();

  const { data: bot } = await supabase
    .from("bots")
    .select("id, system_prompt")
    .eq("id", botId)
    .maybeSingle();
  if (!bot) {
    return Response.json({ error: "Bot not found" }, { status: 404 });
  }

  const latestUser = [...messages].reverse().find((m) => m.role === "user");
  if (!latestUser) {
    return Response.json({ error: "No user message provided" }, { status: 400 });
  }

  let context = "";
  try {
    const queryVec = await embedQuery(latestUser.content);
    const { data: matches } = await supabase.rpc("match_chunks", {
      query_embedding: queryVec,
      match_bot_id: botId,
      match_count: 6,
    });

    if (matches && matches.length > 0) {
      context = matches
        .map(
          (m: { content: string; similarity: number }, i: number) =>
            `[Source ${i + 1}] (relevance ${m.similarity.toFixed(2)})\n${m.content}`
        )
        .join("\n\n---\n\n");
    }
  } catch (err) {
    console.error("RAG retrieval failed:", err);
  }

  const systemPrompt = buildSystemPrompt(bot.system_prompt, context);

  const result = streamText({
    model: groq("llama-3.3-70b-versatile"),
    system: systemPrompt,
    messages: messages as ModelMessage[],
    temperature: 0.3,
    onFinish: async ({ text }) => {
      try {
        await logConversation(botId, visitorId, latestUser.content, text);
      } catch (err) {
        console.error("Failed to log conversation:", err);
      }
    },
  });

  return result.toTextStreamResponse();
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
    const { data: created } = await supabase
      .from("conversations")
      .insert({ bot_id: botId, visitor_id: visitorId })
      .select("id")
      .single();
    convId = created?.id;
  }
  if (!convId) return;

  await supabase.from("messages").insert([
    { conversation_id: convId, role: "user", content: userMessage },
    { conversation_id: convId, role: "assistant", content: assistantMessage },
  ]);
}
