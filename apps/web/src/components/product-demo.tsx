import { Link } from "react-router-dom";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, Check, Copy, FileText, Globe, MessageSquare, Sparkles, Zap } from "lucide-react";

type TabId = "sources" | "embed" | "chat";

const TABS: {
  id: TabId;
  label: string;
  icon: typeof Globe;
  step: string;
  hook: string;
}[] = [
  {
    id: "sources",
    label: "Sources",
    icon: Globe,
    step: "Step 1",
    hook: "Drop in your content — text, URL, or PDF",
  },
  {
    id: "embed",
    label: "Embed",
    icon: Sparkles,
    step: "Step 2",
    hook: "One script tag. Live on any site in seconds.",
  },
  {
    id: "chat",
    label: "Live chat",
    icon: MessageSquare,
    step: "Step 3",
    hook: "Visitors get answers from your docs, not the web",
  },
];

const EMBED_SNIPPET =
  '<script src="https://ragify.tech/widget.js" data-bot="abc123" defer></script>';

const STARTER_QUESTIONS = [
  "What's your refund policy?",
  "How do I get started?",
  "Do you support PDF uploads?",
];

const CANNED_REPLIES: Record<string, string> = {
  "What's your refund policy?":
    "We offer a 14-day money-back guarantee on all paid plans. Just email support with your account — refunds processed within 2 business days. [Source: pricing-guide.pdf]",
  "How do I get started?":
    "Create a bot, add your content, copy the embed script, and paste it before </body>. Most teams go live in under 10 minutes — no code required.",
  "Do you support PDF uploads?":
    "Yes — upload PDFs up to 10 MB. Ragify extracts text, chunks it, and indexes it alongside URLs and free-text. [Source: docs.example.com]",
};

type ChatMessage = { role: "user" | "assistant"; text: string; streaming?: boolean };

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = () => setReduced(mq.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

export function ProductDemo() {
  const [activeTab, setActiveTab] = useState<TabId>("sources");
  const activeMeta = TABS.find((t) => t.id === activeTab)!;

  const selectTab = useCallback((id: TabId) => {
    setActiveTab(id);
  }, []);

  return (
    <div className="demo-frame w-full max-w-5xl mx-auto anim-fade-up delay-3">
      {/* Browser chrome */}
      <div
        className="flex items-center gap-2 px-4 py-3"
        style={{ background: "var(--demo-surface)", borderBottom: "1px solid var(--demo-border)" }}
      >
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
        </div>
        <div
          className="flex-1 mx-4 h-7 rounded-md flex items-center justify-center text-[11px] font-mono"
          style={{ background: "var(--demo-bg)", color: "var(--demo-muted)" }}
        >
          ragify.tech/dashboard
        </div>
      </div>

      {/* Value hook bar */}
      <div
        className="flex items-center justify-between gap-3 px-4 py-2.5"
        style={{ background: "var(--demo-bg)", borderBottom: "1px solid var(--demo-border)" }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="badge badge-success shrink-0">{activeMeta.step}</span>
          <p className="text-[11px] truncate" style={{ color: "var(--demo-fg)" }}>
            {activeMeta.hook}
          </p>
        </div>
        <span
          className="hidden sm:inline-flex items-center gap-1 text-[10px] font-medium shrink-0"
          style={{ color: "var(--accent-fg)" }}
        >
          <Zap className="w-3 h-3" />
          Free to start
        </span>
      </div>

      <div className="flex h-[440px]" style={{ background: "var(--demo-bg)" }}>
        {/* Sidebar */}
        <aside
          className="hidden sm:flex flex-col w-48 shrink-0 py-3 px-2 gap-0.5"
          style={{ borderRight: "1px solid var(--demo-border)" }}
        >
          <p
            className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--demo-muted)" }}
          >
            Your bot
          </p>
          {TABS.map(({ id, label, icon: Icon, step }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeTab === id}
              onClick={() => selectTab(id)}
              className="demo-sidebar-tab flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-lg text-left transition-all"
              style={{
                background: activeTab === id ? "var(--accent-muted)" : "transparent",
                color: activeTab === id ? "var(--accent-fg)" : "var(--demo-muted)",
                border: activeTab === id ? "1px solid var(--accent)" : "1px solid transparent",
              }}
            >
              <span className="flex items-center gap-2 text-xs font-medium">
                <Icon className="w-3.5 h-3.5 shrink-0" />
                {label}
              </span>
              <span className="text-[10px] pl-5.5" style={{ color: "var(--demo-muted)" }}>
                {step}
              </span>
            </button>
          ))}

          <div className="mt-auto mx-2 p-3 rounded-lg" style={{ background: "var(--demo-surface)", border: "1px solid var(--demo-border)" }}>
            <p className="text-[10px] font-semibold mb-1" style={{ color: "var(--demo-fg)" }}>
              Ready to try it?
            </p>
            <p className="text-[10px] leading-relaxed mb-2" style={{ color: "var(--demo-muted)" }}>
              Create your bot free — no credit card.
            </p>
            <Link
              to="/login"
              className="inline-flex items-center gap-1 text-[10px] font-semibold"
              style={{ color: "var(--accent-fg)" }}
            >
              Start free <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </aside>

        {/* Main panel — fixed height, no page scroll bleed */}
        <div className="flex-1 flex flex-col min-w-0 min-h-0">
          <div
            className="sm:hidden flex gap-1 p-2 shrink-0 overflow-x-auto"
            style={{ borderBottom: "1px solid var(--demo-border)" }}
            role="tablist"
          >
            {TABS.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={activeTab === id}
                onClick={() => selectTab(id)}
                className="shrink-0 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all"
                style={{
                  background: activeTab === id ? "var(--accent-muted)" : "var(--demo-surface)",
                  color: activeTab === id ? "var(--accent-fg)" : "var(--demo-muted)",
                  border: activeTab === id ? "1px solid var(--accent)" : "1px solid transparent",
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex-1 min-h-0 p-4 sm:p-5 overflow-hidden">
            {activeTab === "sources" && <SourcesPanel />}
            {activeTab === "embed" && <EmbedPanel onTryChat={() => selectTab("chat")} />}
            {activeTab === "chat" && <ChatPanel />}
          </div>
        </div>
      </div>
    </div>
  );
}

type SourceStatus = "pending" | "indexing" | "ready";
type DemoSource = {
  kind: "text" | "url" | "pdf";
  label: string;
  status: SourceStatus;
};

function SourcesPanel() {
  const chunkCount = 847;
  const [sources] = useState<DemoSource[]>([
    { kind: "text", label: "About us & team bios", status: "ready" },
    { kind: "url", label: "docs.example.com/pricing", status: "ready" },
    { kind: "pdf", label: "pricing-guide.pdf", status: "ready" },
  ]);

  const KindIcon = ({ kind }: { kind: "text" | "url" | "pdf" }) => {
    if (kind === "text" || kind === "pdf") return <FileText className="w-3.5 h-3.5" />;
    return <Globe className="w-3.5 h-3.5" />;
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-start justify-between mb-4 gap-4">
        <div>
          <p className="text-sm font-medium" style={{ color: "var(--demo-fg)" }}>
            Add your knowledge
          </p>
          <p className="text-[11px] mt-0.5" style={{ color: "var(--demo-muted)" }}>
            Mix text, URLs, and PDFs — Ragify indexes them all
          </p>
        </div>
        <div
          className="text-right shrink-0 px-3 py-2 rounded-lg"
          style={{ background: "var(--success-muted)", border: "1px solid var(--accent)" }}
        >
          <p className="text-xl font-bold tabular-nums leading-none" style={{ color: "var(--success)" }}>
            {chunkCount}
          </p>
          <p className="text-[9px] font-semibold uppercase tracking-wide mt-0.5" style={{ color: "var(--accent-fg)" }}>
            chunks ready
          </p>
        </div>
      </div>

      <div className="space-y-2 flex-1 min-h-0 overflow-y-auto">
        {sources.map((src) => (
          <div
            key={src.label}
            className="flex items-center gap-3 px-3 py-3 rounded-lg"
            style={{
              background: "var(--demo-surface)",
              border: "1px solid var(--demo-border)",
            }}
          >
            <span
              className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
              style={{ background: "var(--demo-bg)", color: "var(--demo-muted)" }}
            >
              <KindIcon kind={src.kind} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate" style={{ color: "var(--demo-fg)" }}>
                {src.label}
              </p>
              <p className="text-[10px] capitalize" style={{ color: "var(--demo-muted)" }}>
                {src.kind} source
              </p>
            </div>
            <StatusBadge status={src.status} />
          </div>
        ))}
      </div>

      <div className="mt-4 shrink-0">
        <div className="progress-bar">
          <div className="progress-bar-fill" style={{ width: "100%" }} />
        </div>
        <p className="text-[11px] mt-2 font-medium" style={{ color: "var(--accent-fg)" }}>
          All sources indexed — ready to embed on your site
        </p>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: SourceStatus }) {
  if (status === "ready") return <span className="badge badge-success">Ready</span>;
  if (status === "indexing") return <span className="badge badge-warning">Indexing</span>;
  return <span className="badge badge-muted">Pending</span>;
}

function EmbedPanel({ onTryChat }: { onTryChat: () => void }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(EMBED_SNIPPET);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="mb-4">
        <p className="text-sm font-medium" style={{ color: "var(--demo-fg)" }}>
          Copy. Paste. Done.
        </p>
        <p className="text-[11px] mt-0.5" style={{ color: "var(--demo-muted)" }}>
          Works on WordPress, Shopify, Webflow, React — anywhere you can add HTML
        </p>
      </div>

      <div className="relative mb-3 shrink-0">
        <div
          className="rounded-lg p-3 pr-24 font-mono text-[11px] leading-relaxed"
          style={{
            background: "var(--demo-surface)",
            border: "1px solid var(--demo-border)",
            color: "var(--demo-code)",
          }}
        >
          {EMBED_SNIPPET}
        </div>
        <button
          type="button"
          onClick={copy}
          className="absolute top-2 right-2 flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-semibold transition-all"
          style={{
            background: copied ? "var(--success-muted)" : "var(--accent)",
            color: copied ? "var(--success)" : "#fff",
            border: "1px solid transparent",
          }}
        >
          {copied ? (
            <>
              <Check className="w-3 h-3" /> Copied!
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" /> Copy script
            </>
          )}
        </button>
      </div>

      <p className="text-[10px] mb-2 uppercase tracking-wider font-semibold shrink-0" style={{ color: "var(--demo-muted)" }}>
        Your site with Ragify
      </p>
      <div
        className="flex-1 min-h-0 rounded-lg overflow-hidden relative"
        style={{ border: "1px solid var(--demo-border)", background: "#fff" }}
      >
        <div className="p-5 space-y-2">
          <div className="h-3 w-2/3 bg-zinc-200 rounded" />
          <div className="h-2 w-full bg-zinc-100 rounded" />
          <div className="h-2 w-5/6 bg-zinc-100 rounded" />
        </div>
        <button
          type="button"
          onClick={onTryChat}
          className="absolute bottom-4 right-4 w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-transform hover:scale-105"
          style={{ background: "var(--accent)", color: "#fff" }}
          title="Try the live chat"
        >
          <MessageSquare className="w-5 h-5" />
        </button>
      </div>

      <button
        type="button"
        onClick={onTryChat}
        className="mt-3 w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-[11px] font-semibold shrink-0 transition-colors"
        style={{
          background: "var(--accent-muted)",
          color: "var(--accent-fg)",
          border: "1px solid var(--accent)",
        }}
      >
        Try the live chat demo
        <ArrowRight className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typing, setTyping] = useState(false);
  const [started, setStarted] = useState(false);
  const streamRef = useRef<number | null>(null);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  const scrollChatToBottom = useCallback(() => {
    const el = chatScrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, []);

  useEffect(() => {
    scrollChatToBottom();
  }, [messages, typing, scrollChatToBottom]);

  useEffect(() => {
    return () => {
      if (streamRef.current) window.clearInterval(streamRef.current);
    };
  }, []);

  const askQuestion = useCallback(
    (question: string) => {
      if (streamRef.current) window.clearInterval(streamRef.current);
      setStarted(true);
      const reply = CANNED_REPLIES[question] ?? "I couldn't find that in your indexed content.";

      setMessages((m) => [...m, { role: "user", text: question }]);
      setTyping(true);

      const delay = reducedMotion ? 0 : 500;
      window.setTimeout(() => {
        setTyping(false);
        if (reducedMotion) {
          setMessages((m) => [...m, { role: "assistant", text: reply }]);
          return;
        }

        setMessages((m) => [...m, { role: "assistant", text: "", streaming: true }]);
        let i = 0;
        streamRef.current = window.setInterval(() => {
          i += 3;
          const slice = reply.slice(0, i);
          setMessages((m) => {
            const next = [...m];
            const last = next[next.length - 1];
            if (last?.role === "assistant") {
              next[next.length - 1] = {
                role: "assistant",
                text: slice,
                streaming: i < reply.length,
              };
            }
            return next;
          });
          scrollChatToBottom();
          if (i >= reply.length && streamRef.current) {
            window.clearInterval(streamRef.current);
            streamRef.current = null;
          }
        }, 16);
      }, delay);
    },
    [reducedMotion, scrollChatToBottom],
  );

  const usedQuestions = new Set(messages.filter((m) => m.role === "user").map((m) => m.text));

  return (
    <div className="h-full flex flex-col min-h-0">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div>
          <p className="text-sm font-medium" style={{ color: "var(--demo-fg)" }}>
            See it answer from your content
          </p>
          <p className="text-[11px]" style={{ color: "var(--demo-muted)" }}>
            Click a question — answers come from indexed sources, not the open web
          </p>
        </div>
        <span className="badge badge-success shrink-0">Demo</span>
      </div>

      <div
        ref={chatScrollRef}
        className="flex-1 min-h-0 rounded-lg overflow-y-auto overflow-x-hidden p-3 space-y-2.5 mb-3 overscroll-contain"
        style={{
          background: "var(--demo-surface)",
          border: "1px solid var(--demo-border)",
        }}
      >
        {!started && messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center px-4 py-6">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center mb-3"
              style={{ background: "var(--accent-muted)", color: "var(--accent-fg)" }}
            >
              <MessageSquare className="w-5 h-5" />
            </div>
            <p className="text-xs font-medium mb-1" style={{ color: "var(--demo-fg)" }}>
              Ask anything about your business
            </p>
            <p className="text-[10px] leading-relaxed max-w-[220px]" style={{ color: "var(--demo-muted)" }}>
              Pick a question below. Ragify searches your indexed docs — not ChatGPT&apos;s training data.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className="max-w-[88%] px-3 py-2 rounded-lg text-[11px] leading-relaxed"
              style={{
                background: msg.role === "user" ? "var(--accent)" : "var(--demo-bg)",
                color: msg.role === "user" ? "#fff" : "var(--demo-fg)",
                border:
                  msg.role === "assistant" ? "1px solid var(--demo-border)" : "1px solid transparent",
              }}
            >
              {msg.text}
              {msg.streaming && <span className="demo-caret" aria-hidden />}
            </div>
          </div>
        ))}

        {typing && (
          <div className="flex justify-start">
            <div
              className="px-3 py-2.5 rounded-lg flex gap-1"
              style={{ background: "var(--demo-bg)", border: "1px solid var(--demo-border)" }}
            >
              <span className="typing-dot" />
              <span className="typing-dot" style={{ animationDelay: "0.15s" }} />
              <span className="typing-dot" style={{ animationDelay: "0.3s" }} />
            </div>
          </div>
        )}
      </div>

      <div className="shrink-0 space-y-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: "var(--demo-muted)" }}>
          Try a question
        </p>
        <div className="flex flex-wrap gap-1.5">
          {STARTER_QUESTIONS.filter((q) => !usedQuestions.has(q)).map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => askQuestion(q)}
              disabled={typing}
              className="px-3 py-1.5 rounded-full text-[10px] font-medium transition-all disabled:opacity-50 hover:scale-[1.02]"
              style={{
                background: "var(--demo-surface)",
                color: "var(--demo-fg)",
                border: "1px solid var(--demo-border)",
              }}
            >
              {q}
            </button>
          ))}
        </div>
        {started && (
          <Link
            to="/login"
            className="flex items-center justify-center gap-1.5 w-full py-2.5 rounded-lg text-[11px] font-semibold mt-1"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            Build yours free — takes 10 min
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        )}
      </div>
    </div>
  );
}
