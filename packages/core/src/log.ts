type LogLevel = "debug" | "info" | "warn" | "error";

interface LogFields {
  msg: string;
  level?: LogLevel;
  bot_id?: string;
  user_id?: string;
  request_id?: string;
  latency_ms?: number;
  plan?: string;
  error?: string;
  [key: string]: unknown;
}

export function log(fields: LogFields) {
  const { level = "info", msg, ...rest } = fields;
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    msg,
    ...rest,
  });

  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

/** Optional Sentry — only when @sentry/nextjs is installed (app, not worker). */
function captureSentry(err: unknown, extra: Record<string, unknown>) {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Sentry = require("@sentry/nextjs") as typeof import("@sentry/nextjs");
    Sentry.captureException(err instanceof Error ? err : new Error(String(err)), {
      extra,
    });
  } catch {
    // Worker image has no Sentry — console log only
  }
}

export function logError(msg: string, err: unknown, extra?: Record<string, unknown>) {
  log({
    level: "error",
    msg,
    error: err instanceof Error ? err.message : String(err),
    ...extra,
  });

  captureSentry(err, { msg, ...extra });
}
