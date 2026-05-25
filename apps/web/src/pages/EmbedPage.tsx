import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { ChatUI } from "@/components/chat-ui";

interface BotPublic {
  id: string;
  name: string;
  welcome_message: string;
  primary_color: string;
}

export default function EmbedPage() {
  const { botId } = useParams<{ botId: string }>();
  const [bot, setBot] = useState<BotPublic | null>(null);

  useEffect(() => {
    if (!botId) return;
    fetch(`/api/bots/${botId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.id) setBot(data);
      });
  }, [botId]);

  if (!bot) return null;

  return (
    <ChatUI
      botId={bot.id}
      botName={bot.name}
      welcome={bot.welcome_message}
      color={bot.primary_color}
    />
  );
}
