import Link from "next/link";
import { Bot as BotIcon, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { Bot } from "@/lib/types";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: bots } = await supabase
    .from("bots")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Your bots</h1>
          <p className="text-sm text-[var(--color-muted)]">
            Each bot is trained on one or more URLs from a single site.
          </p>
        </div>
        <Link href="/dashboard/bots/new" className="btn btn-primary">
          <Plus className="w-4 h-4" />
          New bot
        </Link>
      </div>

      {(!bots || bots.length === 0) ? (
        <EmptyState />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(bots as Bot[]).map((b) => (
            <Link
              key={b.id}
              href={`/dashboard/bots/${b.id}`}
              className="card p-5 hover:border-[var(--color-brand)] transition-colors"
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center mb-3"
                style={{ background: `${b.primary_color}22`, color: b.primary_color }}
              >
                <BotIcon className="w-4 h-4" />
              </div>
              <h3 className="font-semibold mb-1">{b.name}</h3>
              <p className="text-xs text-[var(--color-muted)]">
                Created {new Date(b.created_at).toLocaleDateString()}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="card p-12 text-center">
      <BotIcon className="w-12 h-12 mx-auto mb-4 text-[var(--color-muted)]" />
      <h3 className="font-semibold mb-2">No bots yet</h3>
      <p className="text-sm text-[var(--color-muted)] mb-6 max-w-sm mx-auto">
        Create your first bot by giving it a name and pointing it at any URL. We&apos;ll
        crawl the page, index it, and give you an embed snippet within a minute.
      </p>
      <Link href="/dashboard/bots/new" className="btn btn-primary">
        <Plus className="w-4 h-4" />
        Create your first bot
      </Link>
    </div>
  );
}
