import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { Bot } from "@ragify/core/types";

export default function DashboardPage() {
  const [bots, setBots] = useState<Bot[]>([]);

  useEffect(() => {
    supabase
      .from("bots")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => setBots((data as Bot[]) ?? []));
  }, []);

  return (
    <div>
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-xl font-medium tracking-tight" style={{ color: "var(--fg)" }}>Bots</h1>
          <p className="text-sm mt-1" style={{ color: "var(--fg-secondary)" }}>
            AI assistants trained on your website content.
          </p>
        </div>
        <Link to="/dashboard/bots/new" className="btn btn-primary">
          <Plus className="w-4 h-4" /> New bot
        </Link>
      </div>

      {bots.length === 0 ? (
        <div className="card p-16 text-center">
          <p className="text-sm font-medium mb-1" style={{ color: "var(--fg)" }}>No bots yet</p>
          <p className="text-sm mb-6 max-w-xs mx-auto" style={{ color: "var(--fg-secondary)" }}>
            Create your first bot — paste a URL and get an embeddable chat widget in minutes.
          </p>
          <Link to="/dashboard/bots/new" className="btn btn-primary">
            <Plus className="w-4 h-4" /> Create bot
          </Link>
        </div>
      ) : (
        <div className="space-y-1">
          {bots.map((b) => (
            <Link
              key={b.id}
              to={`/dashboard/bots/${b.id}`}
              className="flex items-center gap-3 px-4 py-3 rounded-lg group transition-colors hover:bg-[var(--card-hover)]"
              style={{ color: "var(--fg)" }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-medium"
                style={{ background: `${b.primary_color}18`, color: b.primary_color }}
              >
                {b.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{b.name}</p>
                <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
                  {new Date(b.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </p>
              </div>
              <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" style={{ color: "var(--fg-muted)" }} />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
