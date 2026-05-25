import { useEffect, useState } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { SiteFooter } from "@/components/site-footer";
import type { User } from "@supabase/supabase-js";

export default function DashboardLayout() {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) {
        navigate("/login?next=/dashboard");
        return;
      }
      setUser(data.user);
      setLoading(false);
    });
  }, [navigate]);

  async function logout() {
    await supabase.auth.signOut();
    navigate("/login");
  }

  if (loading) return null;

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
      <header
        className="sticky top-0 z-50 flex items-center justify-between px-5 h-14"
        style={{
          background: "color-mix(in srgb, var(--bg) 90%, transparent)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <Link to="/dashboard" className="text-sm font-medium" style={{ color: "var(--fg)" }}>
          Ragify
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-xs hidden sm:inline" style={{ color: "var(--fg-muted)" }}>
            {user?.email}
          </span>
          <button type="button" onClick={logout} className="btn btn-ghost text-xs">
            Sign out
          </button>
        </div>
      </header>
      <main className="flex-1 max-w-5xl w-full mx-auto px-5 py-10">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}
