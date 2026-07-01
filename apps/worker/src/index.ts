import * as Sentry from "@sentry/node";
import { createCrawlWorker, type CrawlJobPayload } from "@ragify/core/queue";
import { processCrawlJobRecord } from "@ragify/core/crawl-worker";
import { log, logError } from "@ragify/core/log";
import type { Job } from "bullmq";

const dsn = process.env.SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "production",
    release: process.env.SENTRY_RELEASE,
    tracesSampleRate: 0.1,
    initialScope: { tags: { service: "worker" } },
  });
}

function validateEnv() {
  const missing: string[] = [];
  if (!process.env.DATABASE_URL) missing.push("DATABASE_URL");
  if (!process.env.REDIS_URL) missing.push("REDIS_URL");
  if (!process.env.EMBED_URL) missing.push("EMBED_URL");
  if (missing.length > 0) {
    console.error(`[worker] Missing: ${missing.join(", ")}`);
    process.exit(1);
  }
}

validateEnv();

async function processJob(job: Job<CrawlJobPayload>) {
  const { jobId, botId, url, sourceId } = job.data;
  log({ msg: "worker_job_start", job_id: jobId, url, attempt: job.attemptsMade });

  const result = await processCrawlJobRecord(jobId, botId, url, sourceId);
  if (!result.ok) {
    throw new Error(result.error ?? "Crawl failed");
  }

  log({ msg: "worker_job_done", job_id: jobId, chunks: result.chunks });
}

const concurrency = Number(process.env.WORKER_CONCURRENCY ?? 2);
const worker = createCrawlWorker(processJob, concurrency);

worker.on("failed", (job, err) => {
  logError("worker_job_failed", err, { job_id: job?.id, url: job?.data.url });
});

worker.on("completed", (job) => {
  log({ msg: "worker_completed", bull_id: job.id, url: job.data.url });
});

console.log(`[worker] BullMQ consumer started (concurrency=${concurrency})`);

process.on("SIGTERM", async () => {
  await worker.close();
  process.exit(0);
});
