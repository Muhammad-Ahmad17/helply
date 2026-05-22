"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Loader2, Plus, Trash2, RefreshCw, ExternalLink, AlertCircle, CheckCircle2 } from "lucide-react";
import type { Bot, Source } from "@/lib/types";
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
  const [tab, setTab] = useState<"embed" | "sources" | "settings">("embed");

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{bot.name}</h1>
          <p className="text-sm text-[var(--color-muted)] mt-1">
            {chunkCount} text chunks indexed · {sources.length}{" "}
            {sources.length === 1 ? "source" : "sources"}
          </p>
        </div>
        <DeleteButton botId={bot.id} />
      </div>

      <div className="border-b border-[var(--color-border)] flex gap-1 mb-6">
        <TabButton active={tab === "embed"} onClick={() => setTab("embed")}>
          Embed code
        </TabButton>
        <TabButton active={tab === "sources"} onClick={() => setTab("sources")}>
          Sources
        </TabButton>
        <TabButton active={tab === "settings"} onClick={() => setTab("settings")}>
          Settings
        </TabButton>
      </div>

      {tab === "embed" && <EmbedTab bot={bot} chunkCount={chunkCount} />}
      {tab === "sources" && <SourcesTab bot={bot} sources={sources} />}
      {tab === "settings" && <SettingsTab bot={bot} />}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors " +
        (active
          ? "text-[var(--color-fg)] border-[var(--color-brand)]"
          : "text-[var(--color-muted)] border-transparent hover:text-[var(--color-fg)]")
      }
    >
      {children}
    </button>
  );
}

function EmbedTab({ bot, chunkCount }: { bot: Bot; chunkCount: number }) {
  const appUrl = typeof window !== "undefined"
    ? window.location.origin
    : getAppUrl();
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
      <div className="card p-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-medium mb-1">No content indexed yet</p>
            <p className="text-sm text-[var(--color-muted)]">
              Go to the <strong>Sources</strong> tab and crawl your first URL.
              Once at least one source is ready, your embed snippet will appear here.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Paste this on any page</h3>
          <button onClick={copy} className="btn btn-secondary">
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <pre className="bg-black/50 border border-[var(--color-border)] rounded-lg p-4 text-xs overflow-x-auto">
          <code>{snippet}</code>
        </pre>
        <p className="text-xs text-[var(--color-muted)] mt-3">
          Works on WordPress, Shopify, Webflow, plain HTML, anything. The widget
          loads asynchronously and won&apos;t slow down your page.
        </p>
      </div>

      <div className="card p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Preview</h3>
          <a
            href={previewUrl}
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary"
          >
            <ExternalLink className="w-4 h-4" />
            Open in new tab
          </a>
        </div>
        <iframe
          src={previewUrl}
          className="w-full h-[500px] rounded-lg border border-[var(--color-border)] bg-white"
          title="Bot preview"
        />
      </div>
    </div>
  );
}

function SourcesTab({ bot, sources }: { bot: Bot; sources: Source[] }) {
  const [newUrl, setNewUrl] = useState("");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function crawl(sourceId?: string, url?: string) {
    setError(null);
    startTransition(async () => {
      const res = await fetch("/api/crawl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botId: bot.id, sourceId, url }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "Crawl failed");
      } else {
        setNewUrl("");
        // The server action revalidates this path; a hard refresh is the simplest
        // way to see new sources + chunk counts without state management.
        window.location.reload();
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="card p-6">
        <h3 className="font-semibold mb-3">Add a URL</h3>
        <div className="flex gap-2">
          <input
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder="https://example.com/docs/getting-started"
            className="input flex-1"
          />
          <button
            onClick={() => crawl(undefined, newUrl)}
            disabled={!newUrl || pending}
            className="btn btn-primary"
          >
            {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Add &amp; crawl
          </button>
        </div>
        {error && (
          <p className="text-sm text-red-400 mt-2">{error}</p>
        )}
        <p className="text-xs text-[var(--color-muted)] mt-2">
          One URL at a time. Crawling takes 5-15 seconds per page.
        </p>
      </div>

      {sources.length > 0 && (
        <div className="card p-6">
          <h3 className="font-semibold mb-4">Indexed sources</h3>
          <ul className="space-y-3">
            {sources.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between gap-3 p-3 rounded-lg bg-black/30 border border-[var(--color-border)]"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <StatusBadge status={s.status} />
                    <p className="font-medium text-sm truncate">
                      {s.title || s.url}
                    </p>
                  </div>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-[var(--color-muted)] hover:text-[var(--color-brand)] truncate block"
                  >
                    {s.url}
                  </a>
                  {s.error_message && (
                    <p className="text-xs text-red-400 mt-1">{s.error_message}</p>
                  )}
                </div>
                <button
                  onClick={() => crawl(s.id)}
                  disabled={pending}
                  className="btn btn-secondary"
                  title="Re-crawl this URL"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: Source["status"] }) {
  const cfg = {
    pending: { color: "text-[var(--color-muted)]", label: "Pending" },
    crawling: { color: "text-amber-400", label: "Crawling" },
    ready: { color: "text-emerald-400", label: "Ready" },
    error: { color: "text-red-400", label: "Error" },
  }[status];
  return (
    <span className={`text-[10px] uppercase tracking-wider ${cfg.color}`}>
      {status === "ready" ? <CheckCircle2 className="w-3 h-3 inline mr-1" /> : null}
      {cfg.label}
    </span>
  );
}

function SettingsTab({ bot }: { bot: Bot }) {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    setStatus("idle");
    setError(null);
    startTransition(async () => {
      const res = await updateBot(bot.id, formData);
      if (res && "error" in res && res.error) {
        setStatus("error");
        setError(res.error);
      } else {
        setStatus("saved");
        setTimeout(() => setStatus("idle"), 1500);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="card p-6 space-y-5">
      <label className="block">
        <span className="text-sm font-medium mb-1.5 block">Bot name</span>
        <input name="name" defaultValue={bot.name} required className="input" />
      </label>

      <label className="block">
        <span className="text-sm font-medium mb-1.5 block">Welcome message</span>
        <input
          name="welcome_message"
          defaultValue={bot.welcome_message}
          required
          className="input"
        />
        <span className="text-xs text-[var(--color-muted)] mt-1.5 block">
          First message visitors see when they open the chat.
        </span>
      </label>

      <label className="block">
        <span className="text-sm font-medium mb-1.5 block">Primary color</span>
        <div className="flex items-center gap-3">
          <input
            type="color"
            name="primary_color"
            defaultValue={bot.primary_color}
            className="w-12 h-10 rounded-lg border border-[var(--color-border)] bg-transparent cursor-pointer"
          />
          <span className="text-xs text-[var(--color-muted)]">
            Used for the chat bubble + buttons.
          </span>
        </div>
      </label>

      <label className="block">
        <span className="text-sm font-medium mb-1.5 block">System prompt</span>
        <textarea
          name="system_prompt"
          defaultValue={bot.system_prompt}
          required
          rows={5}
          className="input h-auto py-2.5 resize-y font-mono text-xs"
        />
        <span className="text-xs text-[var(--color-muted)] mt-1.5 block">
          Instructions sent to the LLM on every request. Customize the tone and behavior.
        </span>
      </label>

      <div className="flex items-center gap-3 pt-2">
        <button type="submit" disabled={pending} className="btn btn-primary">
          {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
          Save changes
        </button>
        {status === "saved" && (
          <span className="text-sm text-emerald-400 animate-fade-in">Saved.</span>
        )}
        {status === "error" && (
          <span className="text-sm text-red-400">{error}</span>
        )}
      </div>
    </form>
  );
}

function DeleteButton({ botId }: { botId: string }) {
  const [pending, startTransition] = useTransition();
  function onClick() {
    if (!confirm("Delete this bot and all its indexed content? This cannot be undone.")) return;
    startTransition(async () => {
      await deleteBot(botId);
    });
  }
  return (
    <button onClick={onClick} disabled={pending} className="btn btn-secondary text-red-400" title="Delete bot">
      {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
    </button>
  );
}
