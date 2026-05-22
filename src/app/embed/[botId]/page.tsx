import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { ChatUI } from "./chat-ui";

// Public route — anyone with the URL (i.e., the bot owner's visitors) can use it.
// We use the service client because RLS would block the unauthenticated read.
export default async function EmbedPage({
  params,
}: {
  params: Promise<{ botId: string }>;
}) {
  const { botId } = await params;
  const supabase = createServiceClient();

  const { data: bot } = await supabase
    .from("bots")
    .select("id, name, welcome_message, primary_color")
    .eq("id", botId)
    .maybeSingle();

  if (!bot) notFound();

  return (
    <ChatUI
      botId={bot.id}
      botName={bot.name}
      welcome={bot.welcome_message}
      color={bot.primary_color}
    />
  );
}

export const revalidate = 60;
