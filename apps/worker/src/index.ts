/**
 * Long-running crawl worker for VM2.
 * Polls claim_crawl_jobs every POLL_INTERVAL_MS.
 */
import { claimAndProcessJobs } from "@ragify/core/crawl-worker";

const POLL_INTERVAL_MS = Number(process.env.WORKER_POLL_MS ?? 60_000);
const BATCH_SIZE = Number(process.env.WORKER_BATCH_SIZE ?? 5);

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`[worker] Missing required env: ${name}`);
    process.exit(1);
  }
  return value;
}

requireEnv("SUPABASE_SERVICE_ROLE_KEY");
requireEnv("JINA_API_KEY");

console.log(
  `[worker] Starting — poll every ${POLL_INTERVAL_MS}ms, batch ${BATCH_SIZE}`
);

async function tick() {
  try {
    const processed = await claimAndProcessJobs(BATCH_SIZE);
    if (processed > 0) {
      console.log(`[worker] Processed ${processed} crawl job(s)`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[worker] Tick failed: ${message}`);
  }
}

async function main() {
  await tick();
  setInterval(tick, POLL_INTERVAL_MS);
}

main().catch((err) => {
  console.error("[worker] Fatal:", err);
  process.exit(1);
});
