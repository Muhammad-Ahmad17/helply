import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

type UrlRequest = {
  headers: Headers;
  url?: string;
};

/**
 * Resolve the public app URL.
 * Priority: request host (server) → NEXT_PUBLIC_APP_URL → VERCEL_URL → localhost
 */
export function getAppUrl(req?: UrlRequest): string {
  if (req) {
    const forwardedHost = req.headers.get("x-forwarded-host");
    const host = forwardedHost ?? req.headers.get("host");
    if (host) {
      const proto =
        req.headers.get("x-forwarded-proto") ??
        (host.includes("localhost") ? "http" : "https");
      return `${proto}://${host}`.replace(/\/$/, "");
    }
    if (req.url) {
      try {
        return new URL(req.url).origin.replace(/\/$/, "");
      } catch {
        // fall through
      }
    }
  }

  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/$/, "");

  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) return `https://${vercelUrl}`.replace(/\/$/, "");

  return "http://localhost:3000";
}
