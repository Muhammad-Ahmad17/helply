"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Loader2, CheckCircle2, ArrowLeft } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";

function LoginForm() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);

    const res = await fetch("/api/auth/magic-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, next }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setStatus("error");
      setError(body.error ?? "Failed to send magic link");
      return;
    }
    setStatus("sent");
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
      <header className="px-5 h-14 flex items-center">
        <Link href="/" className="text-sm font-medium" style={{ color: "var(--fg)" }}>
          Helply
        </Link>
      </header>

      <div className="flex-1 flex items-center justify-center px-5 pb-12">
        <div className="w-full max-w-sm anim-fade-up">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs mb-8 transition-colors"
            style={{ color: "var(--fg-muted)" }}
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </Link>

          <h1 className="text-2xl font-medium tracking-tight mb-2" style={{ color: "var(--fg)" }}>
            Sign in to Helply
          </h1>
          <p className="text-sm mb-8" style={{ color: "var(--fg-secondary)" }}>
            We&apos;ll send you a magic link. No password needed.
          </p>

          {status === "sent" ? (
            <div className="card p-8 text-center anim-fade-in">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-4" style={{ color: "var(--fg-secondary)" }} />
              <p className="font-medium mb-1" style={{ color: "var(--fg)" }}>Check your inbox</p>
              <p className="text-sm" style={{ color: "var(--fg-secondary)" }}>
                Sent to <strong style={{ color: "var(--fg)" }}>{email}</strong>
              </p>
            </div>
          ) : (
            <form onSubmit={sendLink} className="space-y-4">
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--fg-secondary)" }}>
                  Email
                </label>
                <input
                  type="email"
                  required
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input"
                  autoFocus
                />
              </div>
              <button type="submit" disabled={status === "sending" || !email} className="btn btn-primary w-full btn-lg">
                {status === "sending" && <Loader2 className="w-4 h-4 animate-spin" />}
                Continue
              </button>
              {error && <p className="text-xs text-center" style={{ color: "var(--fg-muted)" }}>{error}</p>}
            </form>
          )}
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
