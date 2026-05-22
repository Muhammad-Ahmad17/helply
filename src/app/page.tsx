import Link from "next/link";
import { ArrowRight, Bot, Globe, MessageSquare, Sparkles, Zap } from "lucide-react";

export default function Home() {
  return (
    <main className="min-h-screen">
      {/* nav */}
      <header className="border-b border-[var(--color-border)]">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-lg">
            <Bot className="w-5 h-5 text-[var(--color-brand)]" />
            Helply
          </div>
          <nav className="flex items-center gap-2">
            <Link href="/login" className="btn btn-secondary">Log in</Link>
            <Link href="/login" className="btn btn-primary">
              Get started <ArrowRight className="w-4 h-4" />
            </Link>
          </nav>
        </div>
      </header>

      {/* hero */}
      <section className="max-w-4xl mx-auto px-6 pt-24 pb-16 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-[var(--color-border)] text-xs text-[var(--color-muted)] mb-6">
          <Sparkles className="w-3.5 h-3.5 text-[var(--color-brand)]" />
          Trained on your content, answers in your voice
        </div>
        <h1 className="text-5xl md:text-6xl font-bold tracking-tight mb-6">
          AI support chat,
          <br />
          <span className="bg-gradient-to-r from-[var(--color-brand)] to-[var(--color-brand-2)] bg-clip-text text-transparent">
            trained on your website.
          </span>
        </h1>
        <p className="text-lg text-[var(--color-muted)] max-w-2xl mx-auto mb-10">
          Paste your site URL. We crawl your docs, build an AI assistant, and give
          you a one-line embed. No code changes, no maintenance.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link href="/login" className="btn btn-primary h-12 px-6 text-base">
            Build my chatbot — free <ArrowRight className="w-4 h-4" />
          </Link>
          <a
            href="#how"
            className="btn btn-secondary h-12 px-6 text-base"
          >
            See how it works
          </a>
        </div>
      </section>

      {/* how it works */}
      <section id="how" className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-center mb-12">Three steps. Five minutes.</h2>
        <div className="grid md:grid-cols-3 gap-6">
          <Step
            n={1}
            icon={<Globe className="w-5 h-5" />}
            title="Paste your URL"
            body="We crawl your site or docs and break it into searchable chunks. JS-free pages work out of the box."
          />
          <Step
            n={2}
            icon={<Zap className="w-5 h-5" />}
            title="We index it"
            body="Each chunk gets a vector embedding stored in Postgres + pgvector. Retrieval is sub-100ms."
          />
          <Step
            n={3}
            icon={<MessageSquare className="w-5 h-5" />}
            title="Embed anywhere"
            body="Drop one <script> tag into your site. Works on WordPress, Shopify, Webflow, anything."
          />
        </div>
      </section>

      {/* pricing */}
      <section className="max-w-5xl mx-auto px-6 py-16">
        <h2 className="text-3xl font-bold text-center mb-3">Simple pricing</h2>
        <p className="text-center text-[var(--color-muted)] mb-12">
          Free while in beta. Pay only when it works for you.
        </p>
        <div className="grid md:grid-cols-3 gap-6">
          <PricingCard
            name="Free"
            price="$0"
            tagline="Try it out"
            features={["1 bot", "100 pages indexed", "500 messages / mo", "Helply branding"]}
            cta="Start free"
          />
          <PricingCard
            name="Starter"
            price="$19"
            tagline="Indie sites"
            features={["3 bots", "1,000 pages", "5,000 messages / mo", "Remove branding"]}
            cta="Coming soon"
            highlighted
          />
          <PricingCard
            name="Pro"
            price="$49"
            tagline="Business sites"
            features={["10 bots", "10,000 pages", "25,000 messages / mo", "Bring your own LLM key"]}
            cta="Coming soon"
          />
        </div>
      </section>

      <footer className="border-t border-[var(--color-border)] py-8 text-center text-sm text-[var(--color-muted)]">
        Made with care · Helply &copy; {new Date().getFullYear()}
      </footer>
    </main>
  );
}

function Step({ n, icon, title, body }: { n: number; icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="card p-6">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-full bg-[var(--color-brand)]/10 text-[var(--color-brand)] flex items-center justify-center">
          {icon}
        </div>
        <span className="text-xs text-[var(--color-muted)]">Step {n}</span>
      </div>
      <h3 className="font-semibold mb-2">{title}</h3>
      <p className="text-sm text-[var(--color-muted)]">{body}</p>
    </div>
  );
}

function PricingCard({
  name,
  price,
  tagline,
  features,
  cta,
  highlighted,
}: {
  name: string;
  price: string;
  tagline: string;
  features: string[];
  cta: string;
  highlighted?: boolean;
}) {
  return (
    <div
      className={
        "card p-6 " +
        (highlighted ? "ring-1 ring-[var(--color-brand)]" : "")
      }
    >
      <div className="flex items-baseline justify-between mb-1">
        <h3 className="font-semibold">{name}</h3>
        {highlighted && (
          <span className="text-[10px] uppercase tracking-wider text-[var(--color-brand)]">
            Popular
          </span>
        )}
      </div>
      <p className="text-xs text-[var(--color-muted)] mb-4">{tagline}</p>
      <div className="mb-6">
        <span className="text-3xl font-bold">{price}</span>
        <span className="text-sm text-[var(--color-muted)]">/mo</span>
      </div>
      <ul className="space-y-2 mb-6 text-sm">
        {features.map((f) => (
          <li key={f} className="text-[var(--color-muted)]">
            ✓ {f}
          </li>
        ))}
      </ul>
      <button className="btn btn-secondary w-full" disabled={cta.includes("soon")}>
        {cta}
      </button>
    </div>
  );
}
