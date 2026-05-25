import { supabase } from "./supabase";
import { slugify } from "./utils";

function parseAllowedOriginsInput(input: string): string[] {
  return input
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((o) => {
      if (o === "*") return "*";
      if (!/^https?:\/\//i.test(o)) return `https://${o}`;
      try {
        const u = new URL(o);
        return `${u.protocol}//${u.host}`;
      } catch {
        return o.replace(/\/$/, "");
      }
    });
}

export async function createBot(name: string, url: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const baseSlug = slugify(name);
  const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`;

  const { data: bot, error } = await supabase
    .from("bots")
    .insert({ owner_id: user.id, name, slug })
    .select()
    .single();

  if (error || !bot) {
    return { error: error?.message ?? "Failed to create bot." };
  }

  const { error: srcError } = await supabase.from("sources").insert({
    bot_id: bot.id,
    url,
    status: "pending",
  });

  if (srcError) return { error: srcError.message };
  return { bot };
}

export async function deleteBot(botId: string) {
  const { error } = await supabase.from("bots").delete().eq("id", botId);
  if (error) return { error: error.message };
  return { success: true };
}

export async function updateBot(
  botId: string,
  data: {
    name: string;
    welcome_message: string;
    primary_color: string;
    system_prompt: string;
    allowed_origins?: string;
  }
) {
  const allowedOrigins = parseAllowedOriginsInput(data.allowed_origins ?? "");

  const { error } = await supabase
    .from("bots")
    .update({
      name: data.name,
      welcome_message: data.welcome_message,
      primary_color: data.primary_color,
      system_prompt: data.system_prompt,
      allowed_origins: allowedOrigins,
    })
    .eq("id", botId);

  if (error) return { error: error.message };
  return { success: true };
}

export async function crawlRequest(
  token: string,
  body: Record<string, unknown>
) {
  const res = await fetch("/api/crawl", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { error: data.error ?? "Crawl failed" };
  return data;
}
