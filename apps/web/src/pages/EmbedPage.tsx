import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Loader2, AlertCircle } from "lucide-react";
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
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!botId) {
      setError("Missing bot ID");
      setLoading(false);
      return;
    }

    let cancelled = false;

    fetch(`/api/bots/${botId}`)
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as {
          id?: string;
          error?: string;
        };
        if (!res.ok) {
          throw new Error(data.error ?? `HTTP ${res.status}`);
        }
        if (!data.id) {
          throw new Error("Bot not found");
        }
        return data as BotPublic;
      })
      .then((data) => {
        if (!cancelled) {
          setBot(data);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : "Failed to load bot";
          setError(msg);
          setBot(null);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [botId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafafa]">
        <Loader2 className="w-5 h-5 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (error || !bot) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#fafafa] p-6">
        <div className="flex items-start gap-2 text-sm text-zinc-600 max-w-sm">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
          <div>
            <p className="font-medium text-zinc-800">Preview unavailable</p>
            <p className="mt-1 text-zinc-500">{error ?? "Bot not found"}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ChatUI
      botId={bot.id}
      botName={bot.name}
      welcome={bot.welcome_message}
      color={bot.primary_color}
    />
  );
}
