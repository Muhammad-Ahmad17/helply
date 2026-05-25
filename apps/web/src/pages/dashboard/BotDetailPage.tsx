import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { BotDetail } from "@/components/bot-detail";
import type { Bot, Source } from "@ragify/core/types";

export default function BotDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [bot, setBot] = useState<Bot | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [chunkCount, setChunkCount] = useState(0);

  useEffect(() => {
    if (!id) return;
    async function load() {
      const { data: b } = await supabase.from("bots").select("*").eq("id", id).maybeSingle();
      if (!b) return;
      setBot(b as Bot);
      const { data: srcs } = await supabase.from("sources").select("*").eq("bot_id", id).order("created_at");
      setSources((srcs as Source[]) ?? []);
      const { count } = await supabase.from("chunks").select("*", { count: "exact", head: true }).eq("bot_id", id);
      setChunkCount(count ?? 0);
    }
    void load();
  }, [id]);

  if (!bot) return null;

  return <BotDetail bot={bot} sources={sources} chunkCount={chunkCount} />;
}
