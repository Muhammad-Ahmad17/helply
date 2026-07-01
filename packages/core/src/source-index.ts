export const MAX_CHUNKS_PER_CRAWL = 200;
export const MAX_TEXT_CONTENT_CHARS = 100_000;

export interface IndexJobResult {
  ok: boolean;
  chunks?: number;
  title?: string;
  error?: string;
}

export function assertIndexEnv(): string | null {
  if (!process.env.DATABASE_URL) return "DATABASE_URL is not set on the server.";
  if (!process.env.EMBED_URL) return "EMBED_URL is not set on the server.";
  return null;
}
