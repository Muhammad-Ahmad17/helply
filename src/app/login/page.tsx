"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Bot, Mail, Loader2, CheckCircle2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getAppUrl } from "@/lib/utils";

export default function LoginPage() {
  const params = useSearchParams();
  const next = params.get("next") ?? "/dashboard";

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${getAppUrl()}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    if (error) {
      setStatus("error");
      setError(error.message);
      return;
    }
    setStatus("sent");
  }

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex items-center justify-center gap-2 mb-8 font-semibold">
          <Bot className="w-5 h-5 text-[var(--color-brand)]" />
          Helply
        </Link>

        <div className="card p-8">
          <h1 className="text-xl font-semibold mb-1 text-center">Sign in to Helply</h1>
          <p className="text-sm text-[var(--color-muted)] text-center mb-6">
            We&apos;ll email you a magic link. No password needed.
          </p>

          {status === "sent" ? (
            <div className="text-center py-4 animate-fade-in">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
              <p className="font-medium mb-1">Check your inbox</p>
              <p className="text-sm text-[var(--color-muted)]">
                We sent a magic link to <strong className="text-[var(--color-fg)]">{email}</strong>.
              </p>
            </div>
          ) : (
            <form onSubmit={sendLink} className="space-y-3">
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input"
                autoFocus
              />
              <button
                type="submit"
                disabled={status === "sending" || !email}
                className="btn btn-primary w-full"
              >
                {status === "sending" ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Mail className="w-4 h-4" />
                )}
                Send magic link
              </button>
              {error && <p className="text-sm text-red-400 text-center">{error}</p>}
            </form>
          )}
        </div>

        <p className="text-xs text-[var(--color-muted)] text-center mt-6">
          By signing in you agree to be a beta tester. No credit card required.
        </p>
      </div>
    </main>
  );
}
