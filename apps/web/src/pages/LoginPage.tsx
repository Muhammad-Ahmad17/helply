import { SignIn } from "@clerk/clerk-react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, Check } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { LogoMark } from "@/components/logo-mark";

const steps = [
  "Name your bot",
  "Add text, URL, or PDF",
  "Copy embed & go live",
];

export default function LoginPage() {
  const [params] = useSearchParams();
  const next = params.get("next") ?? "/dashboard";

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
      <header className="px-5 h-14 flex items-center">
        <Link to="/" className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--fg)" }}>
          <LogoMark size={24} />
          Ragify
        </Link>
      </header>
      <div className="flex-1 grid lg:grid-cols-2 gap-8 px-5 pb-12 max-w-6xl mx-auto w-full items-center">
        <div className="hidden lg:block anim-fade-up">
          <p className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: "var(--accent-fg)" }}>
            Get started free
          </p>
          <h1 className="text-3xl font-medium tracking-tight mb-4" style={{ color: "var(--fg)" }}>
            Your content, answering questions 24/7
          </h1>
          <p className="text-sm mb-8 leading-relaxed max-w-md" style={{ color: "var(--fg-secondary)" }}>
            Ragify indexes your knowledge base and embeds a chat widget on any site — no code beyond one script tag.
          </p>
          <ul className="space-y-3">
            {steps.map((s, i) => (
              <li key={s} className="setup-step">
                <span className="setup-step-icon done">{i + 1}</span>
                <span className="text-sm" style={{ color: "var(--fg-secondary)" }}>{s}</span>
              </li>
            ))}
          </ul>
          <div className="mt-8 flex items-center gap-2 text-xs" style={{ color: "var(--fg-muted)" }}>
            <Check className="w-3.5 h-3.5" style={{ color: "var(--accent)" }} />
            No credit card · 500 free messages/month
          </div>
        </div>

        <div className="w-full max-w-sm mx-auto lg:mx-0 lg:ml-auto anim-fade-up delay-1">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs mb-8 lg:hidden"
            style={{ color: "var(--fg-muted)" }}
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </Link>
          <SignIn routing="hash" forceRedirectUrl={next} signUpUrl="/login" />
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
