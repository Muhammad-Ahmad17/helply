import { Link } from "react-router-dom";
import { ArrowRight, Bot, Code2, Layers } from "lucide-react";
import { SiteNav } from "@/components/site-nav";
import { SiteFooter } from "@/components/site-footer";
import { ProductDemo } from "@/components/product-demo";
import { LogoCloud } from "@/components/logo-cloud";
import { FeatureShowcase } from "@/components/feature-showcase";

export default function Home() {
  return (
    <main className="min-h-screen">
      <SiteNav />
      <Hero />
      <TrustBar />
      <HowItWorks />
      <FeatureShowcase />
      <Testimonials />
      <Pricing />
      <FinalCTA />
      <SiteFooter />
    </main>
  );
}

function Hero() {
  return (
    <section className="relative pt-36 pb-20 px-5 overflow-hidden">
      <div className="hero-grid" />
      <div className="hero-accent-bloom" />
      <div className="hero-glow" />
      <div className="max-w-4xl mx-auto text-center relative z-10">
        <p
          className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1 rounded-full mb-6 anim-fade-up"
          style={{ background: "var(--accent-muted)", color: "var(--accent-fg)" }}
        >
          <span className="hero-eyebrow-dot" aria-hidden />
          Free to start · No credit card
        </p>
        <h1
          className="text-[clamp(2.25rem,6vw,4rem)] font-medium tracking-[-0.03em] leading-[1.08] mb-6 anim-fade-up"
          style={{ color: "var(--fg)" }}
        >
          Turn your docs, site, or PDFs
          <br />
          into an <span className="text-gradient">AI chatbot</span> in minutes
        </h1>
        <p className="text-base sm:text-lg max-w-2xl mx-auto mb-10 leading-relaxed anim-fade-up delay-1 section-desc">
          Ragify indexes your content — text, URLs, and PDFs — and gives you a one-line embed.
          Visitors get accurate answers from your knowledge, not random guesses.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center anim-fade-up delay-2">
          <Link to="/login" className="btn btn-primary btn-lg gap-2">
            Start free
            <ArrowRight className="w-4 h-4" />
          </Link>
          <a href="#how" className="btn btn-secondary btn-lg">
            See how it works
          </a>
        </div>
        <div className="hero-stats mt-8 anim-fade-up delay-2">
          <span>3 source types</span>
          <span className="hero-stats-sep" aria-hidden />
          <span>1-line embed</span>
          <span className="hero-stats-sep" aria-hidden />
          <span>Free tier</span>
        </div>
      </div>

      <div className="mt-16 max-w-5xl mx-auto relative z-10 hero-demo-shell">
        <ProductDemo />
      </div>
    </section>
  );
}

function TrustBar() {
  return (
    <section className="py-16 px-5" style={{ borderTop: "1px solid var(--border)" }}>
      <div className="max-w-4xl mx-auto text-center mb-10">
        <p className="section-eyebrow">Works everywhere</p>
        <p className="text-sm font-medium" style={{ color: "var(--fg-secondary)" }}>
          One script tag. Any stack.
        </p>
      </div>
      <LogoCloud />
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      n: "1",
      title: "Create a bot",
      desc: "Give it a name — no URL required upfront.",
      icon: Bot,
    },
    {
      n: "2",
      title: "Add your knowledge",
      desc: "Paste text, crawl a URL, or upload a PDF. Mix all three.",
      icon: Layers,
    },
    {
      n: "3",
      title: "Embed & chat",
      desc: "Copy one script tag. Your widget goes live on any site.",
      icon: Code2,
    },
  ];

  return (
    <section id="how" className="py-24 px-5" style={{ borderTop: "1px solid var(--border)" }}>
      <div className="max-w-4xl mx-auto text-center mb-14">
        <p className="section-eyebrow">Setup</p>
        <h2 className="section-title mb-3">How it works</h2>
        <p className="section-desc">Three steps from zero to a live AI assistant.</p>
      </div>
      <div className="how-steps max-w-5xl mx-auto grid md:grid-cols-3 gap-5">
        {steps.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.n} className="how-step-card">
              <div className="how-step-card-inner h-full flex flex-col p-6 text-left">
                <div className="flex items-center justify-between mb-5">
                  <div className="how-step-icon-wrap">
                    <Icon className="w-5 h-5" strokeWidth={1.75} />
                  </div>
                  <span className="how-step-num">{s.n}</span>
                </div>
                <h3 className="text-[0.9375rem] font-semibold mb-2 tracking-tight" style={{ color: "var(--fg)" }}>
                  {s.title}
                </h3>
                <p className="text-sm leading-relaxed flex-1" style={{ color: "var(--fg-muted)" }}>
                  {s.desc}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function Testimonials() {
  const quotes = [
    {
      text: "We added Ragify to our docs in under 10 minutes. Support tickets dropped 40% in the first week.",
      author: "Sarah Chen",
      role: "Head of Product",
      initial: "SC",
      metric: "40% fewer tickets",
    },
    {
      text: "Finally an AI chatbot that actually reads our documentation instead of confidently making things up.",
      author: "Marcus Webb",
      role: "CTO",
      initial: "MW",
      metric: "3 bots live",
    },
    {
      text: "One script tag, zero maintenance. Our team updates text sources whenever content changes.",
      author: "Priya Sharma",
      role: "Founder",
      initial: "PS",
      metric: "10 min setup",
    },
  ];

  return (
    <section className="py-24 px-5" style={{ background: "var(--bg-subtle)", borderTop: "1px solid var(--border)" }}>
      <div className="max-w-6xl mx-auto">
        <p className="section-eyebrow text-center">Social proof</p>
        <h2 className="section-title text-center mb-16">Real results. Real content.</h2>
        <div className="grid md:grid-cols-3 gap-6">
          {quotes.map((q) => (
            <blockquote key={q.author} className="testimonial-card card p-6 flex flex-col">
              <p className="text-[0.9375rem] leading-relaxed mb-6 flex-1" style={{ color: "var(--fg)" }}>
                {q.text}
              </p>
              <footer className="flex items-center gap-3">
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-medium shrink-0"
                  style={{ background: "var(--accent-muted)", color: "var(--accent-fg)" }}
                >
                  {q.initial}
                </div>
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--fg)" }}>{q.author}</p>
                  <p className="text-xs" style={{ color: "var(--fg-muted)" }}>{q.role}</p>
                </div>
                <span className="badge badge-success ml-auto shrink-0">{q.metric}</span>
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
        <p className="section-eyebrow">Pricing</p>
        <h2 className="section-title mb-3">Simple pricing</h2>
        <p className="section-desc">Free to start. Upgrade when you need more.</p>
      </div>

      <div className="max-w-4xl mx-auto grid md:grid-cols-3 gap-4 items-start">
        <PriceCard
          name="Free"
          tagline="Try Ragify on one site"
          price="$0"
          features={[
            { label: "1 chatbot", detail: "One AI assistant for a single site or project" },
            { label: "100 pages indexed", detail: "Text, URLs, and PDFs" },
            { label: "500 messages / month", detail: "Enough for testing with real visitors" },
            { label: "Ragify badge", detail: "Small powered-by link on the widget" },
          ]}
          cta="Start free"
          href="/login"
          highlight
        />
        <PriceCard
          name="Starter"
          tagline="For indie sites and portfolios"
          price="$19"
          features={[
            { label: "3 chatbots", detail: "Run assistants for multiple sites or products" },
            { label: "1,000 pages indexed", detail: "Full docs sites and marketing pages" },
            { label: "5,000 messages / month", detail: "Steady traffic without overages" },
            { label: "Remove branding", detail: "White-label widget — no Ragify badge" },
          ]}
          cta="Join waitlist"
          soonNote="Stripe checkout coming soon"
        />
        <PriceCard
          name="Pro"
          tagline="For teams and growing businesses"
          price="$49"
          features={[
            { label: "10 chatbots", detail: "Separate bots per product, locale, or client" },
            { label: "10,000 pages indexed", detail: "Large docs, blogs, and knowledge bases" },
            { label: "25,000 messages / month", detail: "High-volume support and sales chat" },
            { label: "Conversation history", detail: "Review what visitors asked in the dashboard" },
          ]}
          cta="Join waitlist"
          soonNote="Stripe checkout coming soon"
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
  soonNote,
}: {
  name: string;
  tagline: string;
  price: string;
  features: { label: string; detail: string }[];
  cta: string;
  href?: string;
  highlight?: boolean;
  soonNote?: string;
}) {
  const soon = !href;
  return (
    <div
      className={`card p-6 text-left flex flex-col ${highlight ? "pricing-card-highlight" : ""}`}
      style={
        highlight
          ? { borderColor: "var(--accent)", boxShadow: "0 0 0 1px var(--accent-muted)" }
          : undefined
      }
    >
      {highlight && (
        <span className="badge badge-success mb-3 self-start">Recommended</span>
      )}
      <p className="text-sm font-medium mb-0.5" style={{ color: "var(--fg)" }}>{name}</p>
      <p className="text-xs mb-4" style={{ color: "var(--fg-muted)" }}>{tagline}</p>
      <p className="text-3xl font-medium tracking-tight mb-5" style={{ color: "var(--fg)" }}>
        {price}
        <span className="text-sm font-normal" style={{ color: "var(--fg-muted)" }}>/mo</span>
      </p>
      <ul className="mb-6 flex-1">
        {features.map((f) => (
          <li key={f.label} className="pricing-feature-divider">
            <p className="text-sm font-medium" style={{ color: "var(--fg)" }}>{f.label}</p>
            <p className="text-xs mt-0.5 leading-relaxed" style={{ color: "var(--fg-muted)" }}>
              {f.detail}
            </p>
          </li>
        ))}
      </ul>
      {href && !soon ? (
        <Link to={href} className={`btn w-full ${highlight ? "btn-primary" : "btn-secondary"}`}>
          {cta}
        </Link>
      ) : (
        <div>
          <button className="btn btn-secondary w-full" disabled title={soonNote}>
            {cta}
          </button>
          {soonNote && (
            <p className="text-[10px] mt-2 text-center" style={{ color: "var(--fg-muted)" }}>
              {soonNote}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function FinalCTA() {
  return (
    <section className="py-28 px-5" style={{ borderTop: "1px solid var(--border)" }}>
      <div className="cta-gradient-border text-center">
        <h2 className="section-title mb-4">Your content deserves better answers.</h2>
        <p className="section-desc mb-6 max-w-sm mx-auto">Start free. No credit card required.</p>
        <Link to="/login" className="btn btn-primary btn-lg gap-2">
          Start free
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>
    </section>
  );
}
