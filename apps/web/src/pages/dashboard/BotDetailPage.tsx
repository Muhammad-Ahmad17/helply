import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useAuth } from "@clerk/clerk-react";
import { BotDetail } from "@/components/bot-detail";
import { BotDetailSkeleton } from "@/components/ui/skeleton";
import { fetchBot, fetchBotSources } from "@/lib/bots";
import type { Bot, Source } from "@ragify/core/types";

type BotTab = "embed" | "sources" | "usage" | "chats" | "settings";

function parseTab(value: string | null): BotTab {
  if (value === "sources" || value === "usage" || value === "chats" || value === "settings") {
    return value;
  }
  return "embed";
}

export default function BotDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { getToken } = useAuth();
  const [bot, setBot] = useState<Bot | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [chunkCount, setChunkCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const initialTab = parseTab(searchParams.get("tab"));

  const refreshBot = useCallback(async () => {
    if (!id) return;
    const token = await getToken();
    if (!token) return;
    const b = await fetchBot(token, id);
    setBot(b);
  }, [id, getToken]);

  const refreshSources = useCallback(async () => {
    if (!id) return;
    const token = await getToken();
    if (!token) return;
    const { sources: srcs, chunkCount: chunks } = await fetchBotSources(token, id);
    setSources(srcs as Source[]);
    setChunkCount(chunks);
  }, [id, getToken]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    void (async () => {
      const token = await getToken();
      if (!token) {
        setLoading(false);
        return;
      }
      await refreshBot();
      await refreshSources();
      setLoading(false);
    })();
  }, [id, getToken, refreshBot, refreshSources]);

  if (loading || !bot) {
    return <BotDetailSkeleton />;
  }

  return (
    <BotDetail
      bot={bot}
      sources={sources}
      chunkCount={chunkCount}
      initialTab={initialTab}
      onSourcesChange={refreshSources}
      onBotRefresh={refreshBot}
    />
  );
}
