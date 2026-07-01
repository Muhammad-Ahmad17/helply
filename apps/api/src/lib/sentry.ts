import * as Sentry from "@sentry/node";

export function initSentry(service: string) {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? "development",
    release: process.env.SENTRY_RELEASE,
    tracesSampleRate: 0.1,
    initialScope: { tags: { service } },
  });
}

export { Sentry };
