"use server";

// Server Actions for the dashboard.
// A Server Action is a function that runs ONLY on the server but can be called
// directly from a Client Component or HTML form. It's the modern replacement
// for hand-written REST endpoints when the call is internal to your app.
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/utils";

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

const createBotSchema = z.object({
  name: z.string().min(2).max(60),
  url: z.string().url(),
});

export async function createBot(formData: FormData) {
  const parsed = createBotSchema.safeParse({
    name: formData.get("name"),
    url: formData.get("url"),
  });
  if (!parsed.success) {
    return { error: "Invalid input. Name min 2 chars, URL must be a valid http(s) URL." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const baseSlug = slugify(parsed.data.name);
  const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 7)}`;

  const { data: bot, error } = await supabase
    .from("bots")
    .insert({
      owner_id: user.id,
      name: parsed.data.name,
      slug,
    })
    .select()
    .single();

  if (error || !bot) {
    return { error: error?.message ?? "Failed to create bot." };
  }

  const { error: srcError } = await supabase.from("sources").insert({
    bot_id: bot.id,
    url: parsed.data.url,
    status: "pending",
  });
  if (srcError) {
    return { error: srcError.message };
  }

  revalidatePath("/dashboard");
  redirect(`/dashboard/bots/${bot.id}`);
}

export async function deleteBot(botId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("bots").delete().eq("id", botId);
  if (error) return { error: error.message };
  revalidatePath("/dashboard");
  redirect("/dashboard");
}

import { parseAllowedOriginsInput } from "@/lib/security";

const updateBotSchema = z.object({
  name: z.string().min(2).max(60),
  welcome_message: z.string().min(1).max(200),
  primary_color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  system_prompt: z.string().min(10).max(2000),
  allowed_origins: z.string().optional(),
});

export async function updateBot(botId: string, formData: FormData) {
  const parsed = updateBotSchema.safeParse({
    name: formData.get("name"),
    welcome_message: formData.get("welcome_message"),
    primary_color: formData.get("primary_color"),
    system_prompt: formData.get("system_prompt"),
    allowed_origins: formData.get("allowed_origins"),
  });
  if (!parsed.success) {
    return { error: "Invalid input." };
  }

  const allowedOrigins = parseAllowedOriginsInput(parsed.data.allowed_origins ?? "");

  const supabase = await createClient();
  const { error } = await supabase
    .from("bots")
    .update({
      name: parsed.data.name,
      welcome_message: parsed.data.welcome_message,
      primary_color: parsed.data.primary_color,
      system_prompt: parsed.data.system_prompt,
      allowed_origins: allowedOrigins,
    })
    .eq("id", botId);
  if (error) return { error: error.message };

  revalidatePath(`/dashboard/bots/${botId}`);
  return { success: true };
}
