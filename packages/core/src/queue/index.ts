import { Queue, Worker, type Job } from "bullmq";
import IORedis from "ioredis";

export const CRAWL_QUEUE_NAME = "crawl";

export type CrawlJobPayload = {
  jobId: string;
  botId: string;
  sourceId?: string;
  url: string;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RedisConn = any;

let _connection: RedisConn | null = null;

function createRedis(url: string): RedisConn {
  return new (IORedis as unknown as new (url: string, opts?: object) => RedisConn)(
    url,
    { maxRetriesPerRequest: null }
  );
}

export function getRedisConnection(): RedisConn {
  if (!_connection) {
    const url = process.env.REDIS_URL;
    if (!url) throw new Error("REDIS_URL is not set");
    _connection = createRedis(url);
  }
  return _connection;
}

export function getCrawlQueue(): Queue<CrawlJobPayload> {
  return new Queue(CRAWL_QUEUE_NAME, { connection: getRedisConnection() });
}

export async function enqueueCrawlJob(payload: CrawlJobPayload) {
  const queue = getCrawlQueue();
  return queue.add("crawl-url", payload, {
    attempts: 3,
    backoff: { type: "exponential", delay: 5000 },
    removeOnComplete: 100,
    removeOnFail: 200,
  });
}

export async function enqueueCrawlBatch(jobs: CrawlJobPayload[]) {
  const queue = getCrawlQueue();
  return queue.addBulk(
    jobs.map((payload) => ({
      name: "crawl-url",
      data: payload,
      opts: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 200,
      },
    }))
  );
}

export function createCrawlWorker(
  processor: (job: Job<CrawlJobPayload>) => Promise<void>,
  concurrency = 2
) {
  return new Worker(CRAWL_QUEUE_NAME, processor, {
    connection: getRedisConnection(),
    concurrency,
  });
}
