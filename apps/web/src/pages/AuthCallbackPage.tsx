import { useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  return raw;
}

function loginError(message: string, detail?: string): string {
  const params = new URLSearchParams({ error: message });
  if (detail) params.set("detail", detail.slice(0, 500));
  return `/login?${params.toString()}`;
}

export default function AuthCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const next = safeNextPath(params.get("next"));
    const oauthError = params.get("error");
    const oauthDescription = params.get("error_description");

    if (oauthError) {
      navigate(loginError(oauthDescription ?? oauthError));
      return;
    }

    let cancelled = false;

    async function finish(session: boolean, reason: string) {
      if (cancelled) return;
      if (session) {
        navigate(next);
        return;
      }
      console.error("[auth/callback]", reason, window.location.href);
      navigate(loginError("callback_failed", reason));
    }

    async function handle() {
      const code = params.get("code");

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          await finish(false, error.message);
          return;
        }
        await finish(true, "");
        return;
      }

      const { data, error } = await supabase.auth.getSession();
      if (error) {
        await finish(false, error.message);
        return;
      }
      if (data.session) {
        await finish(true, "");
        return;
      }

      // Wait briefly for auth listener (e.g. slow storage)
      const signedIn = await new Promise<boolean>((resolve) => {
        const timeout = window.setTimeout(() => resolve(false), 3000);
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((_event, session) => {
          if (session) {
            window.clearTimeout(timeout);
            subscription.unsubscribe();
            resolve(true);
          }
        });
      });

      if (signedIn) {
        await finish(true, "");
        return;
      }

      const search = window.location.search || "(empty)";
      await finish(
        false,
        `no code in URL (${search}). Check Supabase Redirect URLs include https://ragify.tech/auth/callback`
      );
    }

    void handle();

    return () => {
      cancelled = true;
    };
  }, [params, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--fg-muted)" }} />
    </div>
  );
}
