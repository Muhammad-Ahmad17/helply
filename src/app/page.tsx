import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { ProductDemo } from "@/components/product-demo";

export default function Home() {
  return (
    <main className="min-h-screen">
      <SiteNav />
      <Hero />
      <TrustBar />
      <FeatureSections />
      <Testimonials />
      <Pricing />
      <FinalCTA />
      <SiteFooter />
    </main>
  );
}

function Hero() {
  return (
    <section className="relative pt-32 pb-16 px-5 overflow-hidden">
      <div className="hero-glow" />
      <div className="max-w-4xl mx-auto text-center relative z-10">
        <h1 className="text-[clamp(2.25rem,6vw,4rem)] font-medium tracking-[-0.03em] leading-[1.08] mb-6 anim-fade-up" style={{ color: "var(--fg)" }}>
          Built to make your website
          <br />
          extraordinarily helpful.
        </h1>
        <p className="text-base sm:text-lg max-w-2xl mx-auto mb-8 leading-relaxed anim-fade-up delay-1 section-desc">
          Helply is the best way to add AI support to your site. Paste a URL,
          we index your content, and visitors get instant answers — grounded in
          your docs, not the internet.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center anim-fade-up delay-2">
          <Link href="/login" className="btn btn-primary btn-lg">
            Get Started
          </Link>
          <Link href="/login" className="btn btn-secondary btn-lg">
            Sign in
          </Link>
        </div>
      </div>

      <div className="mt-16 px-5">
        <ProductDemo />
      </div>
    </section>
  );
}

function TrustBar() {
  const logos = ["WordPress", "Shopify", "Webflow", "Next.js", "Stripe", "Notion"];
  return (
    <section className="py-16 px-5" style={{ borderTop: "1px solid var(--border)" }}>
      <p className="text-center text-sm mb-8" style={{ color: "var(--fg-muted)" }}>
        Trusted by teams building world-class websites
      </p>
      <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-center gap-x-10 gap-y-4 opacity-50">
        {logos.map((name) => (
          <span key={name} className="text-sm font-medium" style={{ color: "var(--fg-secondary)" }}>
            {name}
          </span>
        ))}
      </div>
    </section>
  );
}

function FeatureSections() {
  return (
    <div id="features">
      <FeatureBlock
        id="how"
        title="Paste a URL, get a chatbot"
        description="Hand off the hard part to Helply. We crawl your site, chunk the content, embed it into a vector database, and give you a one-line script to embed anywhere."
        linkText="Learn about indexing"
        visual={<IndexingVisual />}
        reverse
      />
      <FeatureBlock
        title="Answers grounded in your content"
        description="Every response is retrieved from your indexed pages first. The AI only speaks from your docs — no hallucinations, no made-up pricing, no wrong API endpoints."
        linkText="Learn about RAG"
        visual={<RagVisual />}
      />
      <FeatureBlock
        title="Embed on any website"
        description="One script tag. Works on WordPress, Shopify, Webflow, static HTML, React apps — anything. The widget loads async and won't slow your page."
        linkText="See embed docs"
        visual={<EmbedVisual />}
        reverse
      />
    </div>
  );
}

function FeatureBlock({
  id,
  title,
  description,
  linkText,
  visual,
  reverse,
}: {
  id?: string;
  title: string;
  description: string;
  linkText: string;
  visual: React.ReactNode;
  reverse?: boolean;
}) {
  return (
    <section
      id={id}
      className="py-24 px-5"
      style={{ borderTop: "1px solid var(--border)" }}
    >
      <div
        className={`max-w-6xl mx-auto grid lg:grid-cols-2 gap-12 lg:gap-16 items-center ${
          reverse ? "lg:[direction:rtl]" : ""
        }`}
      >
        <div className={reverse ? "lg:[direction:ltr]" : ""}>
          <h2 className="section-title mb-4">{title}</h2>
          <p className="section-desc mb-6 max-w-md">{description}</p>
          <span className="link-arrow">
            {linkText} <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </div>
        <div className={reverse ? "lg:[direction:ltr]" : ""}>{visual}</div>
      </div>
    </section>
  );
}

function IndexingVisual() {
  return (
    <div className="demo-frame p-5" style={{ background: "var(--demo-bg)" }}>
      <div className="space-y-3 font-mono text-[12px]">
        <Row label="URL" value="https://tailwindcss.com/docs" />
        <Row label="Status" value="Crawling..." accent />
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--demo-surface)" }}>
          <div className="h-full w-3/4 rounded-full animate-pulse" style={{ background: "var(--demo-fg)" }} />
        </div>
        <Row label="Chunks" value="847 indexed" />
        <Row label="Embeddings" value="1024-dim · pgvector" />
      </div>
    </div>
  );
}

function RagVisual() {
  return (
    <div className="demo-frame p-5 space-y-3" style={{ background: "var(--demo-bg)" }}>
      <div className="text-[11px] px-3 py-2 rounded-lg" style={{ background: "var(--demo-surface)", color: "var(--demo-muted)" }}>
        User: How do I configure dark mode?
      </div>
      <div className="text-[10px] px-2 py-1 rounded" style={{ color: "var(--fg-secondary)" }}>
        ↳ Retrieved 6 chunks · 0.94 similarity
      </div>
      <div className="text-[11px] px-3 py-2 rounded-lg leading-relaxed" style={{ background: "var(--demo-surface)", color: "var(--demo-fg)" }}>
        Add <code className="font-mono text-[10px]" style={{ color: "var(--demo-code)" }}>class=&quot;dark&quot;</code> to your{" "}
        <code className="font-mono text-[10px]" style={{ color: "var(--demo-code)" }}>&lt;html&gt;</code> element, or use the{" "}
        <code className="font-mono text-[10px]" style={{ color: "var(--demo-code)" }}>dark:</code> variant prefix on any utility class.
      </div>
    </div>
  );
}

function EmbedVisual() {
  return (
    <div className="demo-frame overflow-hidden">
      <div className="p-4 font-mono text-[11px]" style={{ background: "var(--demo-surface)", color: "var(--demo-code)" }}>
        {"<script src=\".../widget.js\" data-bot=\"id\" defer></script>"}
      </div>
      <div className="p-6 relative" style={{ background: "#fff", minHeight: 160 }}>
        <div className="space-y-2">
          <div className="h-2.5 w-2/3 bg-zinc-100 rounded" />
          <div className="h-2 w-full bg-zinc-50 rounded" />
          <div className="h-2 w-4/5 bg-zinc-50 rounded" />
        </div>
        <div
          className="absolute bottom-3 right-3 w-12 h-12 rounded-full shadow-lg flex items-center justify-center"
          style={{ background: "var(--fg)", color: "var(--bg)" }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span style={{ color: "var(--demo-muted)" }}>{label}</span>
      <span style={{ color: accent ? "var(--demo-fg)" : "var(--demo-fg)" }}>{value}</span>
    </div>
  );
}

function Testimonials() {
  const quotes = [
    {
      text: "We added Helply to our docs site in 10 minutes. Support tickets dropped 40% in the first week.",
      author: "Sarah Chen",
      role: "Head of Product, Acme Labs",
    },
    {
      text: "Finally a chatbot that actually reads our documentation instead of making things up.",
      author: "Marcus Webb",
      role: "CTO, Stackline",
    },
    {
      text: "One script tag, zero maintenance. Our non-technical team can update sources themselves.",
      author: "Priya Sharma",
      role: "Founder, Docflow",
    },
  ];

  return (
    <section className="py-24 px-5" style={{ background: "var(--bg-subtle)", borderTop: "1px solid var(--border)" }}>
      <div className="max-w-6xl mx-auto">
        <h2 className="section-title text-center mb-16">The new way to support visitors.</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {quotes.map((q) => (
            <blockquote key={q.author}>
              <p className="text-[0.9375rem] leading-relaxed mb-4" style={{ color: "var(--fg)" }}>
                &ldquo;{q.text}&rdquo;
              </p>
              <footer>
                <p className="text-sm font-medium" style={{ color: "var(--fg)" }}>{q.author}</p>
                <p className="text-xs" style={{ color: "var(--fg-muted)" }}>{q.role}</p>
              </footer>
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}

function Pricing() {
  return (
    <section id="pricing" className="py-24 px-5" style={{ borderTop: "1px solid var(--border)" }}>
      <div className="max-w-4xl mx-auto text-center mb-14">
        <h2 className="section-title mb-3">Simple pricing</h2>
        <p className="section-desc">Free to start. Upgrade when you need more.</p>
      </div>

      <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-4">
        <PriceCard
          name="Free"
          tagline="Try Helply on one site"
          price="$0"
          features={[
            { label: "1 chatbot", detail: "One AI assistant for a single website or docs hub" },
            { label: "100 pages indexed", detail: "Crawl and search up to 100 URLs" },
            { label: "500 messages / month", detail: "Enough for testing with real visitors" },
            { label: "Helply badge", detail: "Small powered-by link on the widget" },
          ]}
          cta="Get Started"
          href="/login"
        />
        <PriceCard
          name="Starter"
          tagline="For indie sites and portfolios"
          price="$19"
          features={[
            { label: "3 chatbots", detail: "Run assistants for multiple sites or products" },
            { label: "1,000 pages indexed", detail: "Full docs sites and marketing pages" },
            { label: "5,000 messages / month", detail: "Steady traffic without overages" },
            { label: "Remove branding", detail: "White-label widget — no Helply badge" },
            { label: "Priority crawling", detail: "Re-index sources faster when content changes" },
          ]}
          cta="Coming soon"
          highlight
        />
        <PriceCard
          name="Pro"
          tagline="For teams and growing businesses"
          price="$49"
          features={[
            { label: "10 chatbots", detail: "Separate bots per product, locale, or client" },
            { label: "10,000 pages indexed", detail: "Large docs, blogs, and knowledge bases" },
            { label: "25,000 messages / month", detail: "High-volume support and sales chat" },
            { label: "Bring your own LLM key", detail: "Use OpenAI, Groq, or Anthropic — you control cost" },
            { label: "Conversation history", detail: "Review what visitors asked in the dashboard" },
          ]}
          cta="Coming soon"
        />
      </div>
    </section>
  );
}

function PriceCard({
  name,
  tagline,
  price,
  features,
  cta,
  href,
  highlight,
}: {
  name: string;
  tagline: string;
  price: string;
  features: { label: string; detail: string }[];
  cta: string;
  href?: string;
  highlight?: boolean;
}) {
  const soon = cta.toLowerCase().includes("soon");
  return (
    <div
      className="card p-6 text-left flex flex-col"
      style={highlight ? { borderColor: "var(--border-strong)" } : undefined}
    >
      <p className="text-sm font-medium mb-0.5" style={{ color: "var(--fg)" }}>{name}</p>
      <p className="text-xs mb-4" style={{ color: "var(--fg-muted)" }}>{tagline}</p>
      <p className="text-3xl font-medium tracking-tight mb-5" style={{ color: "var(--fg)" }}>
        {price}
        <span className="text-sm font-normal" style={{ color: "var(--fg-muted)" }}>/mo</span>
      </p>
      <ul className="space-y-3 mb-6 flex-1">
        {features.map((f) => (
          <li key={f.label}>
            <p className="text-sm font-medium" style={{ color: "var(--fg)" }}>{f.label}</p>
            <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--fg-muted)" }}>
              {f.detail}
            </p>
          </li>
        ))}
      </ul>
      {href && !soon ? (
        <Link href={href} className="btn btn-primary w-full">{cta}</Link>
      ) : (
        <button className="btn btn-secondary w-full" disabled={soon}>{cta}</button>
      )}
    </div>
  );
}

function FinalCTA() {
  return (
    <section className="py-28 px-5 text-center" style={{ borderTop: "1px solid var(--border)" }}>
      <h2 className="section-title mb-4">Try Helply now.</h2>
      <Link href="/login" className="btn btn-primary btn-lg">
        Get Started
      </Link>
    </section>
  );
}
