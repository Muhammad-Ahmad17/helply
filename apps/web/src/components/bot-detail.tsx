"use client";

import { useState, useTransition, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
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
  FileText,
  FileUp,
  Link2,
  ChevronDown,
  ChevronUp,
  MessageSquare,
} from "lucide-react";
import type { Bot, Source, CrawlJob } from "@ragify/core/types";
import { PLAN_LIMITS } from "@ragify/core/types";
import { deleteBot, updateBot, crawlRequest, addTextSource, uploadPdfSource, reindexSource, startCheckout, openBillingPortal, fetchCrawlJobs } from "@/lib/bots";
import { useAuth } from "@clerk/clerk-react";
import { SetupChecklist, markSetupFlag } from "@/components/setup-checklist";
import { useToast } from "@/components/ui/toast";

type BotTab = "embed" | "sources" | "usage" | "chats" | "settings";

export function BotDetail({
  bot,
  sources,
  chunkCount,
  initialTab = "embed",
  onSourcesChange,
  onBotRefresh,
}: {
  bot: Bot;
  sources: Source[];
  chunkCount: number;
  initialTab?: "embed" | "sources" | "usage" | "chats" | "settings";
  onSourcesChange: () => Promise<void>;
  onBotRefresh: () => Promise<void>;
}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<BotTab>(initialTab);

  useEffect(() => {
    setTab(parseTabParam(searchParams.get("tab")));
  }, [searchParams]);

  function parseTabParam(value: string | null): BotTab {
    if (value === "sources" || value === "usage" || value === "chats" || value === "settings") return value;
    return "embed";
  }

  function goToTab(next: BotTab) {
    setTab(next);
    navigate(`/dashboard/bots/${bot.id}?tab=${next}`, { replace: true });
    if (next === "settings") markSetupFlag(bot.id, "settingsVisited");
  }

  useEffect(() => {
    if (tab === "usage") void onBotRefresh();
    if (tab === "settings") markSetupFlag(bot.id, "settingsVisited");
  }, [tab, onBotRefresh, bot.id]);

  const tabs = [
    { id: "embed" as const, label: "Embed" },
    { id: "sources" as const, label: "Sources" },
    { id: "usage" as const, label: "Usage" },
    { id: "chats" as const, label: "Chats" },
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

      <SetupChecklist
        botId={bot.id}
        sources={sources}
        chunkCount={chunkCount}
        onGoToTab={goToTab}
      />

      <div
        className="inline-flex gap-0.5 p-0.5 rounded-lg mb-8 flex-wrap"
        style={{ background: "var(--bg-subtle)" }}
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => goToTab(t.id)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              tab === t.id ? "tab-active-accent tab-accent-highlight" : ""
            }`}
            style={
              tab === t.id
                ? undefined
                : { color: "var(--fg-muted)" }
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="anim-fade-in">
        {tab === "embed" && (
          <EmbedTab bot={bot} chunkCount={chunkCount} onGoToSources={() => goToTab("sources")} />
        )}
        {tab === "sources" && (
          <SourcesTab bot={bot} sources={sources} onSourcesChange={onSourcesChange} />
        )}
        {tab === "usage" && <UsageTab bot={bot} botId={bot.id} onRefresh={onBotRefresh} />}
        {tab === "chats" && <ChatsTab botId={bot.id} />}
        {tab === "settings" && <SettingsTab bot={bot} />}
      </div>
    </div>
  );
}

function UsageTab({
  bot,
  botId,
  onRefresh,
}: {
  bot: Bot;
  botId: string;
  onRefresh: () => Promise<void>;
}) {
  const plan = (bot.plan ?? "free") as keyof typeof PLAN_LIMITS;
  const limits = PLAN_LIMITS[plan] ?? PLAN_LIMITS.free;
  const used = bot.monthly_message_count ?? 0;
  const pct = Math.min(100, Math.round((used / limits.messages) * 100));
  const { getToken } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [conversationCount, setConversationCount] = useState(0);

  useEffect(() => {
    void onRefresh();
    void (async () => {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`/api/bots/${botId}/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setConversationCount((data.conversations as unknown[])?.length ?? 0);
    })();
  }, [onRefresh, botId, getToken]);

  const barClass = pct >= 90 ? "error" : pct >= 70 ? "warning" : "";

  async function checkout(planName: "starter" | "pro") {
    setLoading(planName);
    try {
      const token = await getToken();
      if (!token) return;
      const url = await startCheckout(token, planName);
      window.location.href = url;
    } catch (e) {
      alert(e instanceof Error ? e.message : "Checkout failed");
    } finally {
      setLoading(null);
    }
  }

  async function portal() {
    setLoading("portal");
    try {
      const token = await getToken();
      if (!token) return;
      const url = await openBillingPortal(token);
      window.location.href = url;
    } catch (e) {
      alert(e instanceof Error ? e.message : "Portal failed");
    } finally {
      setLoading(null);
    }
  }

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
        <div className="progress-bar mb-2 relative">
          <div className={`progress-bar-fill ${barClass}`} style={{ width: `${pct}%` }} />
          {[25, 50, 90].map((m) => (
            <div
              key={m}
              className="absolute top-0 bottom-0 w-px"
              style={{ left: `${m}%`, background: "var(--border-strong)" }}
              aria-hidden
            />
          ))}
        </div>
        <p className="text-xs mb-3" style={{ color: "var(--fg-muted)" }}>
          {limits.messages - used > 0
            ? `${(limits.messages - used).toLocaleString()} messages remaining`
            : "Monthly limit reached — upgrade to continue"}
        </p>
        <p className="text-xs flex items-center gap-1.5" style={{ color: "var(--fg-secondary)" }}>
          <MessageSquare className="w-3.5 h-3.5" />
          {conversationCount} conversation{conversationCount !== 1 ? "s" : ""} recorded
        </p>
      </div>

      {pct >= 70 && plan === "free" && (
        <div className="card p-5" style={{ borderColor: "var(--warning-muted)" }}>
          <p className="text-sm font-medium mb-1" style={{ color: "var(--fg)" }}>
            Running low on messages?
          </p>
          <p className="text-xs mb-3" style={{ color: "var(--fg-muted)" }}>
            Upgrade for 5,000+ messages/month, more indexed pages, and priority crawling.
          </p>
          <button type="button" disabled={!!loading} onClick={() => checkout("starter")} className="btn btn-accent text-xs">
            {loading === "starter" ? "Loading…" : "Upgrade to Starter — $19/mo"}
          </button>
        </div>
      )}

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

      {plan === "free" && (
        <div className="card p-5 space-y-3">
          <p className="text-sm font-medium" style={{ color: "var(--fg)" }}>Upgrade</p>
          <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
            Checkout via Stripe. Your plan syncs automatically after payment.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!!loading}
              onClick={() => checkout("starter")}
              className="btn btn-primary text-xs"
            >
              {loading === "starter" ? "Loading…" : "Starter — $19/mo"}
            </button>
            <button
              type="button"
              disabled={!!loading}
              onClick={() => checkout("pro")}
              className="btn btn-secondary text-xs"
            >
              {loading === "pro" ? "Loading…" : "Pro — $49/mo"}
            </button>
          </div>
        </div>
      )}

      {plan !== "free" && (
        <div className="card p-5">
          <button type="button" className="btn btn-secondary text-xs" onClick={() => portal()}>
            {loading === "portal" ? "Loading…" : "Manage subscription"}
          </button>
        </div>
      )}
    </div>
  );
}

interface ConversationRow {
  id: string;
  visitor_id: string;
  created_at: string;
  messages: Array<{ role: string; content: string; created_at: string }>;
}

function ChatsTab({ botId }: { botId: string }) {
  const [rows, setRows] = useState<ConversationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const { getToken } = useAuth();

  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins || 1}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  useEffect(() => {
    async function load() {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`/api/bots/${botId}/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setRows((data.conversations as ConversationRow[]) ?? []);
      setLoading(false);
    }
    void load();
  }, [botId, getToken]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--fg-muted)" }} />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="empty-state">
        <MessageSquare className="empty-state-icon" />
        <p className="text-sm font-medium mb-1" style={{ color: "var(--fg)" }}>No conversations yet</p>
        <p className="text-sm max-w-sm mx-auto" style={{ color: "var(--fg-muted)" }}>
          When visitors use your embed widget, their chats appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-w-2xl">
      {rows.map((conv) => {
        const last = conv.messages?.[conv.messages.length - 1];
        const isOpen = expanded === conv.id;
        return (
          <div key={conv.id} className="card overflow-hidden">
            <button
              type="button"
              onClick={() => setExpanded(isOpen ? null : conv.id)}
              className="w-full p-4 text-left flex items-start gap-3 hover:bg-[var(--card-hover)] transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-2 gap-2">
                  <p className="text-xs font-mono truncate" style={{ color: "var(--fg-muted)" }}>
                    Visitor {conv.visitor_id.slice(0, 8)}
                  </p>
                  <span className="badge badge-muted shrink-0">{conv.messages?.length ?? 0} msgs</span>
                </div>
                {last && (
                  <p className="text-sm line-clamp-2" style={{ color: "var(--fg-secondary)" }}>
                    <span className="capitalize font-medium" style={{ color: "var(--fg)" }}>
                      {last.role}:{" "}
                    </span>
                    {last.content}
                  </p>
                )}
                <p className="text-[10px] mt-1" style={{ color: "var(--fg-muted)" }}>
                  {timeAgo(conv.created_at)}
                </p>
              </div>
              {isOpen ? (
                <ChevronUp className="w-4 h-4 shrink-0" style={{ color: "var(--fg-muted)" }} />
              ) : (
                <ChevronDown className="w-4 h-4 shrink-0" style={{ color: "var(--fg-muted)" }} />
              )}
            </button>
            {isOpen && conv.messages && (
              <div className="px-4 pb-4 space-y-2 border-t" style={{ borderColor: "var(--border)" }}>
                {conv.messages.map((m, i) => (
                  <div key={i} className="text-sm py-2">
                    <span className="text-xs font-medium capitalize" style={{ color: "var(--accent-fg)" }}>
                      {m.role}
                    </span>
                    <p className="mt-0.5 whitespace-pre-wrap" style={{ color: "var(--fg-secondary)" }}>
                      {m.content}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function EmbedTab({
  bot,
  chunkCount,
  onGoToSources,
}: {
  bot: Bot;
  chunkCount: number;
  onGoToSources: () => void;
}) {
  const appUrl = typeof window !== "undefined" ? window.location.origin : "";
  const snippet = `<script src="${appUrl}/widget.js" data-bot="${bot.id}" defer></script>`;
  const previewUrl = `${appUrl}/embed/${bot.id}`;
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  function copy() {
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    markSetupFlag(bot.id, "embedCopied");
    toast("Embed snippet copied!", "success");
    setTimeout(() => setCopied(false), 1500);
  }

  function openPreview() {
    markSetupFlag(bot.id, "previewOpened");
    window.open(previewUrl, "_blank", "noopener,noreferrer");
  }

  if (chunkCount === 0) {
    return (
      <div className="empty-state">
        <AlertCircle className="empty-state-icon" style={{ color: "var(--warning)" }} />
        <p className="text-sm font-medium mb-1" style={{ color: "var(--fg)" }}>Index content first</p>
        <p className="text-sm mb-6 max-w-sm mx-auto" style={{ color: "var(--fg-secondary)" }}>
          Add text, a URL, or a PDF on the Sources tab. Embed code unlocks once content is indexed.
        </p>
        <button type="button" onClick={onGoToSources} className="btn btn-accent">
          Go to Sources
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <p className="text-sm font-medium mb-3" style={{ color: "var(--fg)" }}>How to embed</p>
        <ol className="space-y-2 text-sm mb-4" style={{ color: "var(--fg-secondary)" }}>
          <li className="flex gap-2">
            <span className="setup-step-icon done shrink-0 mt-0.5">1</span>
            Copy the snippet below
          </li>
          <li className="flex gap-2">
            <span className="setup-step-icon done shrink-0 mt-0.5">2</span>
            Paste before <code className="text-xs font-mono" style={{ color: "var(--code)" }}>&lt;/body&gt;</code> on your site
          </li>
          <li className="flex gap-2">
            <span className="setup-step-icon done shrink-0 mt-0.5">3</span>
            Open your site — chat bubble appears bottom-right
          </li>
        </ol>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium" style={{ color: "var(--fg)" }}>Embed snippet</p>
          <button onClick={copy} className="btn btn-accent h-8 text-xs">
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
          style={{ borderBottom: "1px solid var(--border)", background: "var(--card)" }}
        >
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ background: bot.primary_color }} />
            <p className="text-sm font-medium" style={{ color: "var(--fg)" }}>Live preview</p>
          </div>
          <button type="button" onClick={openPreview} className="btn btn-secondary h-8 text-xs">
            <ExternalLink className="w-3.5 h-3.5" /> Open
          </button>
        </div>
        <iframe src={previewUrl} className="w-full h-[460px] bg-white" title="Preview" />
      </div>
    </div>
  );
}

function SourcesTab({
  bot,
  sources,
  onSourcesChange,
}: {
  bot: Bot;
  sources: Source[];
  onSourcesChange: () => Promise<void>;
}) {
  type AddMode = "url" | "text" | "pdf";
  const [mode, setMode] = useState<AddMode>("text");
  const [newUrl, setNewUrl] = useState("");
  const [textTitle, setTextTitle] = useState("");
  const [textContent, setTextContent] = useState("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [crawlJobs, setCrawlJobs] = useState<CrawlJob[]>([]);
  const { getToken } = useAuth();
  const { toast } = useToast();

  const addModes: { id: AddMode; label: string; icon: typeof Link2; hint: string }[] = [
    { id: "text", label: "Text", icon: FileText, hint: "Paste about-me, FAQs, or notes" },
    { id: "url", label: "URL", icon: Link2, hint: "Crawl a web page or site" },
    { id: "pdf", label: "PDF", icon: FileUp, hint: "Upload a document (max 10 MB)" },
  ];

  useEffect(() => {
    void onSourcesChange();
  }, [bot.id, onSourcesChange]);

  useEffect(() => {
    let cancelled = false;

    async function pollJobs() {
      const token = await getToken();
      if (!token) return;
      const jobs = await fetchCrawlJobs(token, bot.id);
      if (!cancelled) setCrawlJobs(jobs as CrawlJob[]);
    }

    void pollJobs();
    const id = window.setInterval(pollJobs, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [bot.id, getToken]);

  useEffect(() => {
    if (crawlJobs.length === 0) return;
    const id = window.setInterval(() => {
      void onSourcesChange();
    }, 8000);
    return () => window.clearInterval(id);
  }, [bot.id, crawlJobs.length, onSourcesChange]);

  function refreshSources() {
    startTransition(async () => {
      await onSourcesChange();
    });
  }

  function crawl(sourceId?: string, url?: string, crawlSite?: boolean) {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const token = await getToken();
      if (!token) {
        setError("Not authenticated");
        return;
      }
      const body = await crawlRequest(token, { botId: bot.id, sourceId, url, crawlSite });
      if (body.error) {
        setError(body.error);
        return;
      }
      setNewUrl("");
      toast(body.message ?? "Crawl complete", "success");
      refreshSources();
    });
  }

  function reindex(sourceId: string) {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const token = await getToken();
      if (!token) {
        setError("Not authenticated");
        return;
      }
      const body = await reindexSource(token, bot.id, sourceId);
      if (body.error) {
        setError(body.error);
        return;
      }
      toast(body.message ?? "Re-indexed", "success");
      refreshSources();
    });
  }

  function submitText() {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const token = await getToken();
      if (!token) {
        setError("Not authenticated");
        return;
      }
      const body = await addTextSource(token, bot.id, textTitle.trim(), textContent.trim());
      if (body.error) {
        setError(body.error);
        return;
      }
      setTextTitle("");
      setTextContent("");
      toast(body.message ?? "Text indexed", "success");
      refreshSources();
    });
  }

  function submitPdf() {
    if (!pdfFile) return;
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const token = await getToken();
      if (!token) {
        setError("Not authenticated");
        return;
      }
      const body = await uploadPdfSource(token, bot.id, pdfFile);
      if (body.error) {
        setError(body.error);
        return;
      }
      setPdfFile(null);
      toast(body.message ?? "PDF indexed", "success");
      refreshSources();
    });
  }

  function sourceKind(s: Source): "url" | "text" | "pdf" {
    if (s.kind) return s.kind;
    if (s.url.startsWith("ragify://pdf/")) return "pdf";
    if (s.url.startsWith("ragify://text/")) return "text";
    return "url";
  }

  function sourceSubtitle(s: Source): string {
    const kind = sourceKind(s);
    if (kind === "url") return s.url;
    if (kind === "pdf") return "PDF document";
    return "Personal text context";
  }

  function kindLabel(kind: "url" | "text" | "pdf"): string {
    if (kind === "text") return "Text";
    if (kind === "pdf") return "PDF";
    return "URL";
  }

  return (
    <div className="space-y-4">
      <div className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-medium" style={{ color: "var(--fg)" }}>Knowledge base</p>
            <p className="text-xs mt-0.5" style={{ color: "var(--fg-muted)" }}>
              {sources.length === 0
                ? "No context yet — add text, a URL, or a PDF below."
                : `${sources.length} source${sources.length !== 1 ? "s" : ""} indexed for this bot`}
            </p>
          </div>
        </div>

        {sources.length === 0 ? (
          <div
            className="rounded-lg py-10 px-6 text-center"
            style={{ background: "var(--bg-subtle)", border: "1px dashed var(--border)" }}
          >
            <FileText className="w-8 h-8 mx-auto mb-3" style={{ color: "var(--fg-muted)" }} />
            <p className="text-sm font-medium mb-1" style={{ color: "var(--fg)" }}>Your bot needs context</p>
            <p className="text-xs max-w-sm mx-auto mb-4" style={{ color: "var(--fg-muted)" }}>
              Add personal details as text, crawl a website, or upload a PDF. You can mix all three.
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              <button type="button" onClick={() => setMode("text")} className="btn btn-accent text-xs">
                Add text
              </button>
              <button type="button" onClick={() => setMode("url")} className="btn btn-secondary text-xs">
                Add URL
              </button>
              <button type="button" onClick={() => setMode("pdf")} className="btn btn-secondary text-xs">
                Upload PDF
              </button>
            </div>
          </div>
        ) : (
          <div className="divide-y rounded-lg overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            {sources.map((s) => {
              const kind = sourceKind(s);
              const KindIcon = kind === "url" ? Link2 : kind === "pdf" ? FileUp : FileText;
              return (
                <div
                  key={s.id}
                  className="flex items-center gap-3 px-4 py-3 relative"
                  style={{
                    background: "var(--card)",
                    opacity: s.status === "crawling" ? 0.85 : 1,
                  }}
                >
                  {s.status === "crawling" && (
                    <div
                      className="absolute inset-0 pointer-events-none"
                      style={{ background: "var(--warning-muted)", opacity: 0.3 }}
                    />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                      <StatusBadge status={s.status} />
                      <span
                        className="text-[10px] uppercase tracking-wide font-medium px-1.5 py-0.5 rounded"
                        style={{ background: "var(--bg-subtle)", color: "var(--fg-muted)" }}
                      >
                        {kindLabel(kind)}
                      </span>
                      <KindIcon className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--fg-muted)" }} />
                      <p className="text-sm font-medium truncate" style={{ color: "var(--fg)" }}>
                        {s.title || (kind === "url" ? s.url : kind === "pdf" ? "PDF" : "Text note")}
                      </p>
                    </div>
                    {kind === "url" ? (
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs truncate block hover:underline"
                        style={{ color: "var(--fg-muted)" }}
                      >
                        {s.url}
                      </a>
                    ) : (
                      <p className="text-xs truncate" style={{ color: "var(--fg-muted)" }}>
                        {sourceSubtitle(s)}
                      </p>
                    )}
                    {s.error_message && (
                      <p className="text-xs text-red-500 mt-0.5">{s.error_message}</p>
                    )}
                  </div>
                  <button
                    onClick={() => (kind === "url" ? crawl(s.id) : reindex(s.id))}
                    disabled={pending}
                    title={kind === "pdf" ? "Re-upload PDF to refresh" : "Refresh"}
                    className="btn btn-secondary h-8 px-2"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${pending ? "animate-spin" : ""}`} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {crawlJobs.length > 0 && (
        <div className="card p-4">
          <p className="text-sm font-medium mb-2" style={{ color: "var(--fg)" }}>
            Background crawl queue
          </p>
          <ul className="space-y-2">
            {crawlJobs.map((j) => (
              <li key={j.id} className="flex items-center gap-2 text-xs">
                <Loader2 className="w-3 h-3 animate-spin shrink-0" style={{ color: "#f59e0b" }} />
                <span className="truncate font-mono" style={{ color: "var(--fg-secondary)" }}>
                  {j.url}
                </span>
                <span className="capitalize shrink-0" style={{ color: "var(--fg-muted)" }}>
                  {j.status}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card p-5">
        <p className="text-sm font-medium mb-1" style={{ color: "var(--fg)" }}>Add context</p>
        <p className="text-xs mb-4" style={{ color: "var(--fg-muted)" }}>
          Choose any format — text, URL, or PDF. All are indexed the same way.
        </p>
        <div className="flex gap-1 p-1 rounded-lg mb-4" style={{ background: "var(--bg-subtle)" }}>
          {addModes.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setMode(id);
                setError(null);
                setSuccess(null);
              }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-md text-xs font-medium transition-colors"
              style={{
                background: mode === id ? "var(--bg)" : "transparent",
                color: mode === id ? "var(--fg)" : "var(--fg-muted)",
                boxShadow: mode === id ? "0 1px 2px rgba(0,0,0,0.06)" : "none",
              }}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs mb-3" style={{ color: "var(--fg-muted)" }}>
          {addModes.find((m) => m.id === mode)?.hint}
        </p>
        {mode === "url" && (
          <>
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
              <p className="text-xs mt-2" style={{ color: "var(--fg-muted)" }}>
                Use <strong>Crawl</strong> for one page. &quot;Crawl entire site&quot; is limited on free hosting — prefer single URLs.
              </p>
            )}
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
          </>
        )}

        {mode === "text" && (
          <div className="space-y-3">
            <input
              value={textTitle}
              onChange={(e) => setTextTitle(e.target.value)}
              placeholder="Title (e.g. About me, Product FAQ)"
              className="input w-full"
            />
            <textarea
              value={textContent}
              onChange={(e) => setTextContent(e.target.value)}
              placeholder="Paste personal details, FAQs, policies, or any text your bot should know..."
              className="input w-full min-h-[160px] resize-y"
              rows={8}
            />
            <button
              onClick={submitText}
              disabled={!textTitle.trim() || !textContent.trim() || pending}
              className="btn btn-primary"
            >
              {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Save & index text
            </button>
          </div>
        )}

        {mode === "pdf" && (
          <div className="space-y-3">
            <label
              className="flex flex-col items-center justify-center gap-2 p-8 rounded-lg border border-dashed cursor-pointer transition-colors hover:opacity-80"
              style={{ borderColor: "var(--border)", background: "var(--bg-subtle)" }}
            >
              <FileUp className="w-8 h-8" style={{ color: "var(--fg-muted)" }} />
              <span className="text-sm" style={{ color: "var(--fg-secondary)" }}>
                {pdfFile ? pdfFile.name : "Choose a PDF (max 10 MB)"}
              </span>
              <input
                type="file"
                accept="application/pdf,.pdf"
                className="hidden"
                onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
              />
            </label>
            <button
              onClick={submitPdf}
              disabled={!pdfFile || pending}
              className="btn btn-primary"
            >
              {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Upload & index PDF
            </button>
          </div>
        )}

        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
        {success && <p className="text-xs text-emerald-500 mt-2">{success}</p>}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Source["status"] }) {
  const map = {
    pending: { cls: "badge-muted", label: "Pending" },
    crawling: { cls: "badge-warning", label: "Indexing" },
    ready: { cls: "badge-success", label: "Ready" },
    error: { cls: "badge", label: "Error", style: { background: "var(--error-muted)", color: "var(--error)" } },
  }[status];

  return (
    <span className={`badge ${map.cls}`} style={"style" in map ? map.style : undefined}>
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
  const { getToken } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    markSetupFlag(bot.id, "settingsVisited");
  }, [bot.id]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setSaved(false);
    setError(null);
    startTransition(async () => {
      const token = await getToken();
      if (!token) {
        setError("Not authenticated");
        return;
      }
      const res = await updateBot(token, bot.id, {
        name: (form.elements.namedItem("name") as HTMLInputElement).value,
        welcome_message: (form.elements.namedItem("welcome_message") as HTMLInputElement).value,
        primary_color: (form.elements.namedItem("primary_color") as HTMLInputElement).value,
        system_prompt: (form.elements.namedItem("system_prompt") as HTMLTextAreaElement).value,
        allowed_origins: (form.elements.namedItem("allowed_origins") as HTMLTextAreaElement).value,
      });
      if (res && "error" in res && res.error) {
        setError(res.error);
      } else {
        setSaved(true);
        toast("Settings saved", "success");
        setTimeout(() => setSaved(false), 2000);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 max-w-lg">
      <div className="card p-5 space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--accent-fg)" }}>
          Identity
        </p>
        <Field label="Name" name="name" defaultValue={bot.name} />
        <Field label="Welcome message" name="welcome_message" defaultValue={bot.welcome_message} />
        <div>
          <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--fg-secondary)" }}>
            Brand color
          </label>
          <input
            type="color"
            name="primary_color"
            defaultValue={bot.primary_color}
            className="w-10 h-10 rounded-lg cursor-pointer border-0"
          />
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--accent-fg)" }}>
          Behavior
        </p>
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
          <p className="text-xs mt-1" style={{ color: "var(--fg-muted)" }}>
            Tell the bot how to connect facts across your sources and handle aliases (e.g. same person, different names).
          </p>
        </div>
      </div>

      <div className="card p-5 space-y-4">
        <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: "var(--accent-fg)" }}>
          Security
        </p>
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
      </div>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className="btn btn-primary">
          {pending && <Loader2 className="w-4 h-4 animate-spin" />}
          Save changes
        </button>
        {saved && (
          <span className="text-xs flex items-center gap-1" style={{ color: "var(--success)" }}>
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
  const navigate = useNavigate();
  const [pending, startTransition] = useTransition();
  const { getToken } = useAuth();
  return (
    <button
      onClick={() => {
        if (!confirm("Delete this bot?")) return;
        startTransition(async () => {
          const token = await getToken();
          if (!token) return;
          const res = await deleteBot(token, botId);
          if (!res.error) navigate("/dashboard");
        });
      }}
      disabled={pending}
      className="btn btn-ghost text-red-500"
    >
      {pending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
    </button>
  );
}
