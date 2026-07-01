import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, ChevronRight, Bot, FileText, Code } from "lucide-react";
import { useAuth } from "@clerk/clerk-react";
import { fetchBots } from "@/lib/bots";
import { BotListSkeleton } from "@/components/ui/skeleton";
import type { Bot as BotType } from "@ragify/core/types";

export default function DashboardPage() {
  const { getToken } = useAuth();
  const [bots, setBots] = useState<BotType[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const token = await getToken();
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const list = await fetchBots(token);
        setBots(list);
      } finally {
        setLoading(false);
      }
    })();
  }, [getToken]);

  return (
    <div>
      <div className="flex items-end justify-between mb-8 gap-4">
        <div>
          <h1 className="text-xl font-medium tracking-tight" style={{ color: "var(--fg)" }}>
            Your bots
          </h1>
          <p className="text-sm mt-1" style={{ color: "var(--fg-secondary)" }}>
            Train AI assistants on your content and embed them anywhere.
          </p>
        </div>
        <Link to="/dashboard/bots/new" className="btn btn-primary shrink-0">
          <Plus className="w-4 h-4" /> New bot
        </Link>
      </div>

      {loading ? (
        <BotListSkeleton />
      ) : bots.length === 0 ? (
        <div className="empty-state anim-fade-up">
          <Bot className="empty-state-icon" />
          <p className="text-sm font-medium mb-1" style={{ color: "var(--fg)" }}>
            Create your first bot
          </p>
          <p className="text-sm mb-6 max-w-sm mx-auto" style={{ color: "var(--fg-secondary)" }}>
            Name your bot, add context as text, URLs, or PDFs, then embed a chat widget on your site.
          </p>
          <ul className="text-left text-xs space-y-2 max-w-xs mx-auto mb-8" style={{ color: "var(--fg-muted)" }}>
            <li className="flex items-center gap-2">
              <FileText className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--accent)" }} />
              Add personal details, docs, or crawl a website
            </li>
            <li className="flex items-center gap-2">
              <Bot className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--accent)" }} />
              AI answers from your indexed knowledge
            </li>
            <li className="flex items-center gap-2">
              <Code className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--accent)" }} />
              One script tag to embed on any site
            </li>
          </ul>
          <Link to="/dashboard/bots/new" className="btn btn-primary btn-lg">
            <Plus className="w-4 h-4" /> Create your first bot
          </Link>
        </div>
      ) : (
        <div className="space-y-1">
          {bots.map((b) => (
            <Link
              key={b.id}
              to={`/dashboard/bots/${b.id}`}
              className="flex items-center gap-3 px-4 py-3 rounded-lg group transition-colors hover:bg-[var(--card-hover)] card"
              style={{ color: "var(--fg)", boxShadow: "var(--shadow-card)" }}
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-sm font-medium"
                style={{ background: `${b.primary_color}18`, color: b.primary_color }}
              >
                {b.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{b.name}</p>
                <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
                  {new Date(b.created_at).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                  {" · "}
                  <span className="capitalize">{b.plan ?? "free"}</span> plan
                </p>
              </div>
              <ChevronRight
                className="w-4 h-4 opacity-40 group-hover:opacity-100 transition-opacity shrink-0"
                style={{ color: "var(--fg-muted)" }}
              />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
