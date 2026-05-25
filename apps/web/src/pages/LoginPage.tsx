"use client";

import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Loader2, CheckCircle2, ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { SiteFooter } from "@/components/site-footer";

const RESEND_COOLDOWN_SEC = 60;

function GoogleIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}

export default function LoginPage() {
  const [params] = useSearchParams();
  const next = params.get("next") ?? "/dashboard";
  const callbackError = params.get("error");

  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [oauthLoading, setOauthLoading] = useState<"google" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (callbackError === "callback_failed") {
      setError("Sign-in failed. Please try again.");
    } else if (callbackError) {
      setError(decodeURIComponent(callbackError));
    }
  }, [callbackError]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  async function signInWithGoogle() {
    setOauthLoading("google");
    setError(null);
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo, queryParams: { prompt: "select_account" } },
    });
    if (oauthError) {
      setOauthLoading(null);
      setError(oauthError.message);
    }
  }

  async function sendLink(e: React.FormEvent) {
    e.preventDefault();
    if (cooldown > 0) return;
    setStatus("sending");
    setError(null);
    const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    if (otpError) {
      setStatus("error");
      setError(otpError.message);
      setCooldown(RESEND_COOLDOWN_SEC);
      return;
    }
    setStatus("sent");
    setCooldown(RESEND_COOLDOWN_SEC);
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
      <header className="px-5 h-14 flex items-center">
        <Link to="/" className="text-sm font-medium" style={{ color: "var(--fg)" }}>Ragify</Link>
      </header>
      <div className="flex-1 flex items-center justify-center px-5 pb-12">
        <div className="w-full max-w-sm anim-fade-up">
          <Link to="/" className="inline-flex items-center gap-1.5 text-xs mb-8" style={{ color: "var(--fg-muted)" }}>
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </Link>
          <h1 className="text-2xl font-medium tracking-tight mb-2" style={{ color: "var(--fg)" }}>Sign in to Ragify</h1>
          <p className="text-sm mb-8" style={{ color: "var(--fg-secondary)" }}>
            Continue with Google, or use a magic link sent to your email.
          </p>
          <button type="button" onClick={signInWithGoogle} disabled={oauthLoading !== null} className="btn btn-secondary w-full btn-lg mb-6">
            {oauthLoading === "google" ? <Loader2 className="w-4 h-4 animate-spin" /> : <GoogleIcon />}
            Continue with Google
          </button>
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
            <span className="text-xs" style={{ color: "var(--fg-muted)" }}>or</span>
            <div className="flex-1 h-px" style={{ background: "var(--border)" }} />
          </div>
          {status === "sent" ? (
            <div className="card p-8 text-center anim-fade-in">
              <CheckCircle2 className="w-8 h-8 mx-auto mb-4" style={{ color: "var(--fg-secondary)" }} />
              <p className="font-medium mb-1" style={{ color: "var(--fg)" }}>Check your inbox</p>
              <p className="text-sm mb-4" style={{ color: "var(--fg-secondary)" }}>
                Sent to <strong style={{ color: "var(--fg)" }}>{email}</strong>
              </p>
            </div>
          ) : (
            <form onSubmit={sendLink} className="space-y-4">
              <div>
                <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--fg-secondary)" }}>Email</label>
                <input type="email" required placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
              </div>
              <button type="submit" disabled={status === "sending" || !email || cooldown > 0} className="btn btn-primary w-full btn-lg">
                {status === "sending" && <Loader2 className="w-4 h-4 animate-spin" />}
                {cooldown > 0 ? `Wait ${cooldown}s` : "Send magic link"}
              </button>
              {error && <p className="text-xs text-center" style={{ color: "#ef4444" }}>{error}</p>}
            </form>
          )}
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
