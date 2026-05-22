import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("is_admin")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile?.is_admin) {
    redirect("/dashboard");
  }

  const service = createServiceClient();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: botCount },
    { count: messageCount },
    { count: errorJobs },
    { data: topBots },
    { data: recentJobs },
  ] = await Promise.all([
    service.from("bots").select("*", { count: "exact", head: true }),
    service
      .from("messages")
      .select("*", { count: "exact", head: true })
      .gte("created_at", since),
    service
      .from("crawl_jobs")
      .select("*", { count: "exact", head: true })
      .eq("status", "error"),
    service
      .from("bots")
      .select("id, name, plan, monthly_message_count")
      .order("monthly_message_count", { ascending: false })
      .limit(5),
    service
      .from("crawl_jobs")
      .select("id, url, status, last_error, created_at")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-xl font-medium tracking-tight mb-2" style={{ color: "var(--fg)" }}>
        Admin
      </h1>
      <p className="text-sm mb-8" style={{ color: "var(--fg-muted)" }}>
        System metrics and operational overview
      </p>

      <div className="grid sm:grid-cols-3 gap-4 mb-8">
        <StatCard label="Total bots" value={botCount ?? 0} />
        <StatCard label="Messages (7d)" value={messageCount ?? 0} />
        <StatCard label="Failed crawls" value={errorJobs ?? 0} />
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="card p-5">
          <p className="text-sm font-medium mb-4" style={{ color: "var(--fg)" }}>
            Top bots by usage
          </p>
          <ul className="space-y-2">
            {(topBots ?? []).map((b) => (
              <li key={b.id} className="flex justify-between text-sm py-1.5">
                <span style={{ color: "var(--fg)" }}>{b.name}</span>
                <span style={{ color: "var(--fg-muted)" }}>
                  {b.monthly_message_count} msgs · {b.plan}
                </span>
              </li>
            ))}
            {(!topBots || topBots.length === 0) && (
              <li className="text-sm" style={{ color: "var(--fg-muted)" }}>No data yet</li>
            )}
          </ul>
        </div>

        <div className="card p-5">
          <p className="text-sm font-medium mb-4" style={{ color: "var(--fg)" }}>
            Recent crawl jobs
          </p>
          <ul className="space-y-2">
            {(recentJobs ?? []).map((j) => (
              <li key={j.id} className="text-xs py-1.5">
                <div className="flex justify-between gap-2">
                  <span className="truncate" style={{ color: "var(--fg)" }}>{j.url}</span>
                  <span
                    className="shrink-0 capitalize"
                    style={{
                      color:
                        j.status === "error"
                          ? "#ef4444"
                          : j.status === "done"
                            ? "#10b981"
                            : "var(--fg-muted)",
                    }}
                  >
                    {j.status}
                  </span>
                </div>
                {j.last_error && (
                  <p className="text-red-500 mt-0.5 truncate">{j.last_error}</p>
                )}
              </li>
            ))}
            {(!recentJobs || recentJobs.length === 0) && (
              <li className="text-sm" style={{ color: "var(--fg-muted)" }}>No jobs yet</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-5">
      <p className="text-xs mb-1" style={{ color: "var(--fg-muted)" }}>{label}</p>
      <p className="text-2xl font-medium" style={{ color: "var(--fg)" }}>
        {value.toLocaleString()}
      </p>
    </div>
  );
}
