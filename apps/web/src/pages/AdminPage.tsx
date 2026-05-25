import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Loader2, Shield, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getAccessToken } from "@/lib/supabase";

interface AdminStats {
  bots: number;
  sources: number;
  conversations: number;
  activeCrawlJobs: number;
  users: number;
  planCounts: { free: number; starter: number; pro: number };
  failedCrawls: Array<{
    id: string;
    bot_id: string;
    url: string;
    last_error: string | null;
    created_at: string;
  }>;
}

export default function AdminPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login?next=/admin");
        return;
      }

      const token = await getAccessToken();
      if (!token) {
        navigate("/login?next=/admin");
        return;
      }

      const res = await fetch("/api/admin/stats", {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 403) {
        setForbidden(true);
        setLoading(false);
        return;
      }

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `HTTP ${res.status}`);
        setLoading(false);
        return;
      }

      setStats(await res.json());
      setLoading(false);
    }
    void load();
  }, [navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: "var(--bg)" }}>
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--fg-muted)" }} />
      </div>
    );
  }

  if (forbidden) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5" style={{ background: "var(--bg)" }}>
        <div className="text-center max-w-sm">
          <AlertCircle className="w-8 h-8 mx-auto mb-3 text-amber-500" />
          <p className="font-medium" style={{ color: "var(--fg)" }}>Admin access required</p>
          <p className="text-sm mt-1" style={{ color: "var(--fg-muted)" }}>
            Set <code className="text-xs">is_admin = true</code> on your row in <code className="text-xs">user_profiles</code>.
          </p>
          <Link to="/dashboard" className="btn btn-secondary mt-4 inline-flex">Back to dashboard</Link>
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5" style={{ background: "var(--bg)" }}>
        <p className="text-sm text-red-500">{error ?? "Failed to load stats"}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-5 py-10" style={{ background: "var(--bg)" }}>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-2 mb-8">
          <Shield className="w-5 h-5" style={{ color: "var(--fg)" }} />
          <h1 className="text-xl font-medium" style={{ color: "var(--fg)" }}>Admin</h1>
          <Link to="/dashboard" className="ml-auto text-xs" style={{ color: "var(--fg-muted)" }}>Dashboard</Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
          <StatCard label="Bots" value={stats.bots} />
          <StatCard label="Sources" value={stats.sources} />
          <StatCard label="Conversations" value={stats.conversations} />
          <StatCard label="Users" value={stats.users} />
          <StatCard label="Active crawl jobs" value={stats.activeCrawlJobs} />
        </div>

        <div className="card p-5 mb-6">
          <p className="text-sm font-medium mb-3" style={{ color: "var(--fg)" }}>Plans</p>
          <ul className="text-sm space-y-1" style={{ color: "var(--fg-secondary)" }}>
            <li>Free: {stats.planCounts.free}</li>
            <li>Starter: {stats.planCounts.starter}</li>
            <li>Pro: {stats.planCounts.pro}</li>
          </ul>
        </div>

        {stats.failedCrawls.length > 0 && (
          <div className="card p-5">
            <p className="text-sm font-medium mb-3" style={{ color: "var(--fg)" }}>Recent failed crawls</p>
            <ul className="space-y-2 text-xs">
              {stats.failedCrawls.map((j) => (
                <li key={j.id} style={{ color: "var(--fg-muted)" }}>
                  <span className="font-mono">{j.url}</span>
                  {j.last_error && <span className="text-red-500 block mt-0.5">{j.last_error}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-4">
      <p className="text-xs" style={{ color: "var(--fg-muted)" }}>{label}</p>
      <p className="text-2xl font-medium mt-1" style={{ color: "var(--fg)" }}>{value}</p>
    </div>
  );
}
