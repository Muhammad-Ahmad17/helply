import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Bot, Source } from "@ragify/core/types";
import { BotDetail } from "./bot-detail";

export default async function BotPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: bot }, { data: sources }, { count: chunkCount }] = await Promise.all([
    supabase.from("bots").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("sources")
      .select("*")
      .eq("bot_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("chunks")
      .select("*", { count: "exact", head: true })
      .eq("bot_id", id),
  ]);

  if (!bot) notFound();

  return (
    <div className="max-w-3xl mx-auto">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1 text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)] mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Back to bots
      </Link>

      <BotDetail
        bot={bot as Bot}
        sources={(sources ?? []) as Source[]}
        chunkCount={chunkCount ?? 0}
      />
    </div>
  );
}
