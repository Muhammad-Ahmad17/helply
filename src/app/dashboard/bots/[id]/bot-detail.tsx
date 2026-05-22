"use client";

import { useState, useTransition } from "react";
import {
  Check,
  Copy,
  Loader2,
  Plus,
  Trash2,
  RefreshCw,
  ExternalLink,
  AlertCircle,
  CheckCircle2,
  Globe,
} from "lucide-react";
import type { Bot, Source } from "@/lib/types";
import { PLAN_LIMITS } from "@/lib/types";
import { deleteBot, updateBot } from "@/app/dashboard/actions";
import { getAppUrl } from "@/lib/utils";

export function BotDetail({
  bot,
  sources,
  chunkCount,
}: {
  bot: Bot;
  sources: Source[];
  chunkCount: number;
}) {
  const [tab, setTab] = useState<"embed" | "sources" | "usage" | "settings">("embed");

  const tabs = [
    { id: "embed" as const, label: "Embed" },
    { id: "sources" as const, label: "Sources" },
    { id: "usage" as const, label: "Usage" },
    { id: "settings" as const, label: "Settings" },
  ];

  return (
    <div>
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-xl font-medium tracking-tight" style={{ color: "var(--fg)" }}>
            {bot.name}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--fg-muted)" }}>
            {chunkCount} chunks · {sources.length} source{sources.length !== 1 ? "s" : ""} ·{" "}
            <span className="capitalize">{bot.plan ?? "free"}</span> plan
          </p>
        </div>
        <DeleteButton botId={bot.id} />
      </div>

      <div
        className="inline-flex gap-0.5 p-0.5 rounded-lg mb-8"
        style={{ background: "var(--bg-subtle)" }}
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="px-3 py-1.5 rounded-md text-xs font-medium transition-all"
            style={
              tab === t.id
                ? { background: "var(--card)", color: "var(--fg)", boxShadow: "0 1px 2px var(--glow)" }
                : { color: "var(--fg-muted)" }
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="anim-fade-in">
        {tab === "embed" && <EmbedTab bot={bot} chunkCount={chunkCount} />}
        {tab === "sources" && <SourcesTab bot={bot} sources={sources} />}
        {tab === "usage" && <UsageTab bot={bot} />}
        {tab === "settings" && <SettingsTab bot={bot} />}
      </div>
    </div>
  );
}

function UsageTab({ bot }: { bot: Bot }) {
  const plan = (bot.plan ?? "free") as keyof typeof PLAN_LIMITS;
  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
  const used = bot.monthly_message_count ?? 0;
  const pct = Math.min(100, Math.round((used / limits.messages) * 100));

  return (
    <div className="space-y-4 max-w-lg">
      <div className="card p-5">
        <p className="text-sm font-medium mb-1" style={{ color: "var(--fg)" }}>
          Messages this month
        </p>
        <p className="text-2xl font-medium tracking-tight mb-4" style={{ color: "var(--fg)" }}>
          {used.toLocaleString()}
          <span className="text-sm font-normal" style={{ color: "var(--fg-muted)" }}>
            {" "}/ {limits.messages.toLocaleString()}
          </span>
        </p>
        <div
          className="h-2 rounded-full overflow-hidden mb-2"
          style={{ background: "var(--bg-subtle)" }}
        >
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${pct}%`,
              background: pct >= 90 ? "#ef4444" : pct >= 70 ? "#f59e0b" : "var(--fg)",
            }}
          />
        </div>
        <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
          {limits.messages - used > 0
            ? `${(limits.messages - used).toLocaleString()} messages remaining`
            : "Monthly limit reached — upgrade to continue"}
        </p>
      </div>

      <div className="card p-5">
        <p className="text-sm font-medium mb-3" style={{ color: "var(--fg)" }}>Plan limits</p>
        <ul className="space-y-2 text-sm">
          <li className="flex justify-between" style={{ color: "var(--fg-secondary)" }}>
            <span>Plan</span>
            <span className="capitalize font-medium" style={{ color: "var(--fg)" }}>{plan}</span>
          </li>
          <li className="flex justify-between" style={{ color: "var(--fg-secondary)" }}>
            <span>Messages / month</span>
            <span className="font-medium" style={{ color: "var(--fg)" }}>{limits.messages.toLocaleString()}</span>
          </li>
          <li className="flex justify-between" style={{ color: "var(--fg-secondary)" }}>
            <span>Pages indexed</span>
            <span className="font-medium" style={{ color: "var(--fg)" }}>{limits.pages.toLocaleString()}</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

function EmbedTab({ bot, chunkCount }: { bot: Bot; chunkCount: number }) {
  const appUrl = typeof window !== "undefined" ? window.location.origin : getAppUrl();
  const snippet = `<script src="${appUrl}/api/widget.js" data-bot="${bot.id}" defer></script>`;
  const previewUrl = `${appUrl}/embed/${bot.id}`;
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (chunkCount === 0) {
    return (
      <div className="card p-6 flex gap-3">
        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium" style={{ color: "var(--fg)" }}>Index content first</p>
          <p className="text-sm mt-0.5" style={{ color: "var(--fg-secondary)" }}>
            Go to Sources and crawl a URL. Embed code appears once content is indexed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium" style={{ color: "var(--fg)" }}>Embed snippet</p>
          <button onClick={copy} className="btn btn-secondary h-8 text-xs">
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <pre
          className="rounded-lg p-4 text-xs font-mono overflow-x-auto"
          style={{ background: "var(--bg-subtle)", color: "var(--code)" }}
        >
          {snippet}
        </pre>
      </div>

      <div className="demo-frame overflow-hidden">
        <div
          className="flex items-center justify-between px-4 py-3"
          style={{ borderBottom: "1px solid var(--border)" }}
        >
          <p className="text-sm font-medium" style={{ color: "var(--fg)" }}>Preview</p>
          <a href={previewUrl} target="_blank" rel="noreferrer" className="btn btn-secondary h-8 text-xs">
            <ExternalLink className="w-3.5 h-3.5" /> Open
          </a>
        </div>
        <iframe src={previewUrl} className="w-full h-[460px] bg-white" title="Preview" />
      </div>
    </div>
  );
}

function SourcesTab({ bot, sources }: { bot: Bot; sources: Source[] }) {
  const [newUrl, setNewUrl] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function crawl(sourceId?: string, url?: string, crawlSite?: boolean) {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const res = await fetch("/api/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botId: bot.id, sourceId, url, crawlSite }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Crawl failed");
        return;
      }
      setNewUrl("");
      setSuccess(body.message ?? "Crawl complete");
      setTimeout(() => window.location.reload(), 1500);
    });
  }

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <p className="text-sm font-medium mb-3" style={{ color: "var(--fg)" }}>Add URL</p>
        <div className="flex gap-2">
          <input
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder="https://example.com/docs"
            className="input flex-1"
          />
          <button
            onClick={() => crawl(undefined, newUrl)}
            disabled={!newUrl || pending}
            className="btn btn-primary shrink-0"
          >
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Crawl
          </button>
        </div>
        {newUrl && (
          <button
            onClick={() => crawl(undefined, newUrl, true)}
            disabled={!newUrl || pending}
            className="btn btn-secondary mt-2 text-xs"
          >
            <Globe className="w-3.5 h-3.5" />
            Crawl entire site (sitemap)
          </button>
        )}
        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
        {success && <p className="text-xs text-emerald-500 mt-2">{success}</p>}
      </div>

      {sources.length > 0 && (
        <div className="card divide-y" style={{ ["--tw-divide-opacity" as string]: 1 }}>
          {sources.map((s) => (
            <div key={s.id} className="flex items-center gap-3 px-4 py-3" style={{ borderColor: "var(--border)" }}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <StatusBadge status={s.status} />
                  <p className="text-sm font-medium truncate" style={{ color: "var(--fg)" }}>
                    {s.title || s.url}
                  </p>
                </div>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs truncate block hover:underline"
                  style={{ color: "var(--fg-muted)" }}
                >
                  {s.url}
                </a>
                {s.error_message && (
                  <p className="text-xs text-red-500 mt-0.5">{s.error_message}</p>
                )}
              </div>
              <button
                onClick={() => crawl(s.id)}
                disabled={pending}
                className="btn btn-secondary h-8 px-2"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${pending ? "animate-spin" : ""}`} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: Source["status"] }) {
  const map = {
    pending: { bg: "var(--bg-subtle)", color: "var(--fg-muted)", label: "Pending" },
    crawling: { bg: "rgba(245,158,11,0.1)", color: "#f59e0b", label: "Crawling" },
    ready: { bg: "rgba(16,185,129,0.1)", color: "#10b981", label: "Ready" },
    error: { bg: "rgba(239,68,68,0.1)", color: "#ef4444", label: "Error" },
  }[status];

  return (
    <span
      className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-medium px-1.5 py-0.5 rounded"
      style={{ background: map.bg, color: map.color }}
    >
      {status === "ready" && <CheckCircle2 className="w-3 h-3" />}
      {status === "crawling" && <Loader2 className="w-3 h-3 animate-spin" />}
      {map.label}
    </span>
  );
}

function SettingsTab({ bot }: { bot: Bot }) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const allowedOriginsValue = (bot.allowed_origins ?? []).join("\n");

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaved(false);
    setError(null);
    startTransition(async () => {
      const res = await updateBot(bot.id, new FormData(e.currentTarget));
      if (res && "error" in res && res.error) {
        setError(res.error);
      } else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="card p-5 space-y-4 max-w-lg">
      <Field label="Name" name="name" defaultValue={bot.name} />
      <Field label="Welcome message" name="welcome_message" defaultValue={bot.welcome_message} />
      <div>
        <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--fg-secondary)" }}>
          Allowed domains
        </label>
        <textarea
          name="allowed_origins"
          defaultValue={allowedOriginsValue}
          rows={3}
          placeholder={"https://example.com\nhttps://www.example.com"}
          className="input h-auto py-2 resize-y font-mono text-xs"
        />
        <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>
          One origin per line. Leave empty to allow all origins during setup. Use * to explicitly allow all.
        </p>
      </div>
      <div>
        <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--fg-secondary)" }}>
          Color
        </label>
        <input
          type="color"
          name="primary_color"
          defaultValue={bot.primary_color}
          className="w-10 h-10 rounded-lg cursor-pointer border-0"
        />
      </div>
      <div>
        <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--fg-secondary)" }}>
          System prompt
        </label>
        <textarea
          name="system_prompt"
          defaultValue={bot.system_prompt}
          required
          rows={4}
          className="input h-auto py-2 resize-y font-mono text-xs"
        />
      </div>
      <div className="divider" />
      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn btn-primary">
          {pending && <Loader2 className="w-4 h-4 animate-spin" />}
          Save
        </button>
        {saved && (
          <span className="text-xs text-emerald-500 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" /> Saved
          </span>
        )}
        {error && <span className="text-xs text-red-500">{error}</span>}
      </div>
    </form>
  );
}

function Field({ label, name, defaultValue }: { label: string; name: string; defaultValue: string }) {
  return (
    <div>
      <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--fg-secondary)" }}>
        {label}
      </label>
      <input name={name} defaultValue={defaultValue} required className="input" />
    </div>
  );
}

function DeleteButton({ botId }: { botId: string }) {
  const [pending, startTransition] = useTransition();
  return (
    <button
      onClick={() => {
        if (!confirm("Delete this bot?")) return;
        startTransition(async () => {
          await deleteBot(botId);
        });
      }}
      disabled={pending}
      className="btn btn-ghost text-red-500"
    >
      {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
    </button>
  );
}
