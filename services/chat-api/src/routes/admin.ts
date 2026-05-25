import type { Context } from "hono";
import { getUserFromBearer } from "@ragify/core/auth";
import { createServiceClient } from "@ragify/core/supabase/service";
import { logError } from "@ragify/core/log";

async function requireAdmin(c: Context) {
  const user = await getUserFromBearer(c.req.header("authorization"));
  if (!user) return null;

  const supabase = createServiceClient();
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("is_admin")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!profile?.is_admin) return null;
  return user;
}

export async function adminStatsGet(c: Context) {
  const admin = await requireAdmin(c);
  if (!admin) return c.json({ error: "Forbidden" }, 403);

  const supabase = createServiceClient();

  const [bots, sources, conversations, crawlJobs, profiles] = await Promise.all([
    supabase.from("bots").select("id", { count: "exact", head: true }),
    supabase.from("sources").select("id", { count: "exact", head: true }),
    supabase.from("conversations").select("id", { count: "exact", head: true }),
    supabase
      .from("crawl_jobs")
      .select("id", { count: "exact", head: true })
      .in("status", ["pending", "running", "error"]),
    supabase.from("user_profiles").select("user_id, plan, is_admin"),
  ]);

  const failedCrawls = await supabase
    .from("crawl_jobs")
    .select("id, bot_id, url, status, last_error, created_at")
    .eq("status", "error")
    .order("created_at", { ascending: false })
    .limit(20);

  if (bots.error || sources.error) {
    logError("admin_stats_failed", bots.error ?? sources.error);
    return c.json({ error: "Failed to load stats" }, 500);
  }

  const planCounts = { free: 0, starter: 0, pro: 0 };
  for (const p of profiles.data ?? []) {
    const plan = (p.plan ?? "free") as keyof typeof planCounts;
    if (plan in planCounts) planCounts[plan]++;
  }

  return c.json({
    bots: bots.count ?? 0,
    sources: sources.count ?? 0,
    conversations: conversations.count ?? 0,
    activeCrawlJobs: crawlJobs.count ?? 0,
    users: profiles.data?.length ?? 0,
    planCounts,
    failedCrawls: failedCrawls.data ?? [],
  });
}
