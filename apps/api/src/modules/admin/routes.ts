import type { Context } from "hono";
import { countAdminStats, getUserById } from "@ragify/core/db";
import { logError } from "@ragify/core/log";

export async function adminStatsGet(c: Context) {
  const user = c.get("user");
  const dbUser = await getUserById(user.id);
  if (!dbUser?.is_admin) return c.json({ error: "Forbidden" }, 403);

  try {
    const stats = await countAdminStats();
    return c.json(stats);
  } catch (err) {
    logError("admin_stats_failed", err);
    return c.json({ error: "Failed to load stats" }, 500);
  }
}
