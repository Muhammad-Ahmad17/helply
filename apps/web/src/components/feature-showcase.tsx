import { Link } from "react-router-dom";
import {
  ArrowRight,
  Check,
  FileText,
  Globe,
  MessageSquare,
  Search,
} from "lucide-react";

const FEATURES = [
  {
    id: "index",
    eyebrow: "Indexing",
    title: "From URL to chatbot in 60 seconds",
    description:
      "Paste any URL. Ragify crawls the page, splits it into semantic chunks, embeds them, and hands you a one-line script — no config required.",
    bullets: ["Text, URL, and PDF sources", "Automatic chunking & embedding", "No infrastructure to manage"],
    href: "/login",
    linkText: "Get started free",
    reverse: true,
  },
  {
    id: "rag",
    eyebrow: "RAG",
    title: "Answers from your content, not the internet",
    description:
      "Every response starts with a vector search over your indexed sources. The AI quotes your docs, not its training data.",
    bullets: ["Retrieval before every reply", "Source citations included", "No hallucinated policies"],
    href: "#how",
    linkText: "See how it works",
    reverse: false,
  },
  {
    id: "embed",
    eyebrow: "Embed",
    title: "One script tag, any platform",
    description:
      "Drop a single script tag anywhere — WordPress, Shopify, Webflow, raw HTML, React. The widget is async and isolated in an iframe.",
    bullets: ["Works on any site or CMS", "Async load — zero layout shift", "Matches your brand colors"],
    href: "/login",
    linkText: "Start free",
    reverse: true,
  },
] as const;

export function FeatureShowcase() {
  return (
    <div id="features">
      <section
        className="pt-24 pb-4 px-5 text-center"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <div className="max-w-4xl mx-auto">
          <p className="section-eyebrow">Why Ragify</p>
          <h2 className="section-title mb-3">Built for your content, not generic AI</h2>
          <p className="section-desc max-w-xl mx-auto">
            Index once, answer accurately, embed anywhere — without running your own vector stack.
          </p>
        </div>
      </section>
      {FEATURES.map((f) => (
        <FeatureRow key={f.id} feature={f} />
      ))}
    </div>
  );
}

function FeatureRow({ feature }: { feature: (typeof FEATURES)[number] }) {
  const isInternal = feature.href.startsWith("/");

  return (
    <section
      className="feature-row py-20 sm:py-24 px-5"
      style={{ borderTop: "1px solid var(--border)" }}
    >
      <div
        className={`feature-row-grid max-w-6xl mx-auto grid lg:grid-cols-2 gap-10 lg:gap-16 items-center ${
          feature.reverse ? "lg:[direction:rtl]" : ""
        }`}
      >
        <div className={`feature-row-copy ${feature.reverse ? "lg:[direction:ltr]" : ""}`}>
          <p className="section-eyebrow">{feature.eyebrow}</p>
          <h2 className="section-title mb-4 max-w-md">{feature.title}</h2>
          <p className="section-desc mb-6 max-w-md">{feature.description}</p>
          <ul className="feature-bullets mb-8 space-y-2.5">
            {feature.bullets.map((b) => (
              <li key={b} className="flex items-start gap-2.5 text-sm" style={{ color: "var(--fg-secondary)" }}>
                <Check className="w-4 h-4 shrink-0 mt-0.5" style={{ color: "var(--accent-fg)" }} strokeWidth={2.5} />
                {b}
              </li>
            ))}
          </ul>
          {isInternal ? (
            <Link to={feature.href} className="link-arrow">
              {feature.linkText} <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          ) : (
            <a href={feature.href} className="link-arrow">
              {feature.linkText} <ArrowRight className="w-3.5 h-3.5" />
            </a>
          )}
        </div>

        <div className={`feature-row-visual ${feature.reverse ? "lg:[direction:ltr]" : ""}`}>
          {feature.id === "index" && <IndexVisual />}
          {feature.id === "rag" && <RagVisual />}
          {feature.id === "embed" && <EmbedVisual />}
        </div>
      </div>
    </section>
  );
}

function VisualFrame({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="feature-visual-frame demo-frame overflow-hidden">
      <div
        className="flex items-center gap-2 px-4 py-2.5"
        style={{ background: "var(--demo-surface)", borderBottom: "1px solid var(--demo-border)" }}
      >
        <div className="flex gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
        </div>
        <span className="text-[10px] font-mono ml-2" style={{ color: "var(--demo-muted)" }}>
          {label}
        </span>
      </div>
      {children}
    </div>
  );
}

function IndexVisual() {
  return (
    <VisualFrame label="ragify · indexing">
      <div className="p-5 space-y-4" style={{ background: "var(--demo-bg)" }}>
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium" style={{ color: "var(--demo-fg)" }}>
            Crawling sources
          </span>
          <span className="badge badge-success">Complete</span>
        </div>
        <div className="space-y-2">
          {[
            { icon: Globe, label: "https://docs.example.com/pricing" },
            { icon: FileText, label: "pricing-guide.pdf" },
            { icon: FileText, label: "FAQ & refund policy (text)" },
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg"
              style={{ background: "var(--demo-surface)", border: "1px solid var(--demo-border)" }}
            >
              <Icon className="w-4 h-4 shrink-0" style={{ color: "var(--demo-muted)" }} />
              <span className="flex-1 text-[11px] font-mono truncate" style={{ color: "var(--demo-fg)" }}>
                {label}
              </span>
              <Check className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--success)" }} />
            </div>
          ))}
        </div>
        <div>
          <div className="flex justify-between text-[10px] mb-1.5 font-mono" style={{ color: "var(--demo-muted)" }}>
            <span>847 chunks indexed</span>
            <span style={{ color: "var(--accent-fg)" }}>384-dim · pgvector</span>
          </div>
          <div className="progress-bar">
            <div className="progress-bar-fill" style={{ width: "100%" }} />
          </div>
        </div>
      </div>
    </VisualFrame>
  );
}

function RagVisual() {
  return (
    <VisualFrame label="ragify · chat">
      <div className="p-5 space-y-3" style={{ background: "var(--demo-bg)" }}>
        <div
          className="text-[11px] px-3 py-2.5 rounded-lg ml-auto max-w-[85%]"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          How do I configure dark mode?
        </div>
        <div
          className="flex items-center gap-1.5 text-[10px] px-1"
          style={{ color: "var(--accent-fg)" }}
        >
          <Search className="w-3 h-3" />
          Retrieved 6 chunks · 0.94 similarity
        </div>
        <div
          className="text-[11px] px-3 py-3 rounded-lg leading-relaxed max-w-[95%]"
          style={{ background: "var(--demo-surface)", border: "1px solid var(--demo-border)", color: "var(--demo-fg)" }}
        >
          Add{" "}
          <code className="font-mono text-[10px] px-1 py-0.5 rounded" style={{ background: "var(--demo-bg)", color: "var(--demo-code)" }}>
            class=&quot;dark&quot;
          </code>{" "}
          to your{" "}
          <code className="font-mono text-[10px] px-1 py-0.5 rounded" style={{ background: "var(--demo-bg)", color: "var(--demo-code)" }}>
            &lt;html&gt;
          </code>{" "}
          element, or use the{" "}
          <code className="font-mono text-[10px] px-1 py-0.5 rounded" style={{ background: "var(--demo-bg)", color: "var(--demo-code)" }}>
            dark:
          </code>{" "}
          variant prefix.
          <span className="block mt-2 text-[10px]" style={{ color: "var(--demo-muted)" }}>
            Source: docs.example.com/configuration
          </span>
        </div>
      </div>
    </VisualFrame>
  );
}

function EmbedVisual() {
  return (
    <VisualFrame label="your-site.com">
      <div
        className="px-4 py-3 font-mono text-[11px] leading-relaxed"
        style={{ background: "var(--demo-surface)", color: "var(--demo-code)", borderBottom: "1px solid var(--demo-border)" }}
      >
        {'<script src=".../widget.js" data-bot="id" defer></script>'}
      </div>
      <div className="relative p-6 min-h-[200px]" style={{ background: "#fff" }}>
        <div className="space-y-2 mb-4">
          <div className="h-3 w-2/3 bg-zinc-200 rounded" />
          <div className="h-2 w-full bg-zinc-100 rounded" />
          <div className="h-2 w-4/5 bg-zinc-100 rounded" />
          <div className="h-2 w-3/5 bg-zinc-100 rounded" />
        </div>
        <div
          className="absolute bottom-4 right-4 w-12 h-12 rounded-full shadow-lg flex items-center justify-center"
          style={{ background: "var(--accent)", color: "#fff" }}
        >
          <MessageSquare className="w-5 h-5" />
        </div>
      </div>
    </VisualFrame>
  );
}
