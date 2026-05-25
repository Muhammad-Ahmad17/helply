import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

function safeNextPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  return raw;
}

export default function AuthCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    async function handle() {
      const code = params.get("code");
      const next = safeNextPath(params.get("next"));
      const oauthError = params.get("error");
      const oauthDescription = params.get("error_description");

      if (oauthError) {
        navigate(`/login?error=${encodeURIComponent(oauthDescription ?? oauthError)}`);
        return;
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (!error) {
          navigate(next);
          return;
        }
      }

      navigate("/login?error=callback_failed");
    }
    void handle();
  }, [params, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--fg-muted)" }} />
    </div>
  );
}
