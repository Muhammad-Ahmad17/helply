// Lightweight HTML crawler with SSRF protection.
import * as cheerio from "cheerio";
import dns from "dns/promises";
import net from "net";

const FETCH_TIMEOUT_MS = 15_000;
const MAX_BYTES = 2_000_000;
const MAX_REDIRECTS = 3;
const USER_AGENT =
  "HelplyBot/1.0 (+https://helply.aamad.app; AI documentation indexing)";

const REMOVE_SELECTORS = [
  "script",
  "style",
  "noscript",
  "nav",
  "footer",
  "header",
  "aside",
  "iframe",
  "[role='navigation']",
  ".navigation",
  ".sidebar",
  ".cookie-banner",
  ".cookies",
];

export interface CrawlResult {
  url: string;
  title: string;
  text: string;
}

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const parts = ip.split(".").map(Number);
    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    return false;
  }

  if (net.isIPv6(ip)) {
    const normalized = ip.toLowerCase();
    if (normalized === "::1") return true;
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
    if (normalized.startsWith("fe80")) return true;
  }

  return false;
}

export async function assertSafeUrl(input: string): Promise<URL> {
  let parsed: URL;
  try {
    parsed = new URL(input);
  } catch {
    throw new UnsafeUrlError("Invalid URL");
  }

  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw new UnsafeUrlError("Only http(s) URLs are allowed");
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, "");

  if (net.isIP(hostname)) {
    throw new UnsafeUrlError("Direct IP addresses are not allowed");
  }

  if (
    hostname === "localhost" ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    throw new UnsafeUrlError("Internal hostnames are not allowed");
  }

  let addresses: Array<{ address: string; family: number }>;
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch {
    throw new UnsafeUrlError(`Could not resolve hostname: ${hostname}`);
  }

  for (const { address } of addresses) {
    if (isPrivateIp(address)) {
      throw new UnsafeUrlError("URL resolves to a private or reserved IP address");
    }
  }

  return parsed;
}

async function fetchWithRedirects(url: string): Promise<Response> {
  let current = url;
  for (let i = 0; i <= MAX_REDIRECTS; i++) {
    await assertSafeUrl(current);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
      const res = await fetch(current, {
        signal: controller.signal,
        redirect: "manual",
        headers: { "User-Agent": USER_AGENT, Accept: "text/html,*/*;q=0.8" },
      });

      if (res.status >= 300 && res.status < 400) {
        const location = res.headers.get("location");
        if (!location) {
          throw new Error(`Redirect ${res.status} without Location header`);
        }
        current = new URL(location, current).toString();
        continue;
      }

      return res;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new Error(`Too many redirects (max ${MAX_REDIRECTS})`);
}

export async function crawlUrl(input: string): Promise<CrawlResult> {
  const url = normalizeUrl(input);
  const res = await fetchWithRedirects(url);

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} when fetching ${url}`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html") && !contentType.includes("xml")) {
    throw new Error(`Unsupported content-type: ${contentType}`);
  }

  const buf = await res.arrayBuffer();
  if (buf.byteLength > MAX_BYTES) {
    throw new Error(`Page exceeds ${MAX_BYTES} bytes`);
  }
  const html = new TextDecoder("utf-8").decode(buf);

  return extractText(url, html);
}

function extractText(url: string, html: string): CrawlResult {
  const $ = cheerio.load(html);
  for (const sel of REMOVE_SELECTORS) $(sel).remove();

  const title =
    $("title").first().text().trim() ||
    $("meta[property='og:title']").attr("content") ||
    new URL(url).hostname;

  const root = $("main").length ? $("main") : $("article").length ? $("article") : $("body");

  root
    .find("p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, br")
    .each((_, el) => {
      $(el).append("\n");
    });

  const text = root.text().replace(/[ \t]+/g, " ").replace(/\n[ \t]+/g, "\n");

  return { url, title, text };
}

function normalizeUrl(input: string): string {
  let trimmed = input.trim();
  if (!/^https?:\/\//i.test(trimmed)) trimmed = "https://" + trimmed;
  const u = new URL(trimmed);
  u.hash = "";
  return u.toString();
}

export async function discoverLinks(seedUrl: string, limit = 10): Promise<string[]> {
  const url = normalizeUrl(seedUrl);
  await assertSafeUrl(url);
  const origin = new URL(url).origin;

  try {
    const res = await fetchWithRedirects(url);
    if (!res.ok) return [];
    const html = await res.text();
    const $ = cheerio.load(html);
    const seen = new Set<string>();
    $("a[href]").each((_, el) => {
      const href = $(el).attr("href");
      if (!href) return;
      try {
        const abs = new URL(href, url).toString();
        if (abs.startsWith(origin) && !seen.has(abs)) {
          seen.add(abs);
        }
      } catch {
        // ignore malformed href
      }
    });
    return Array.from(seen).slice(0, limit);
  } catch {
    return [];
  }
}

const PLAN_PAGE_LIMITS: Record<string, number> = {
  free: 100,
  starter: 1000,
  pro: 10000,
};

export function getPageLimitForPlan(plan: string): number {
  return PLAN_PAGE_LIMITS[plan] ?? PLAN_PAGE_LIMITS.free;
}

/**
 * Discover URLs from sitemap.xml, falling back to link discovery.
 */
export async function discoverFromSitemap(
  seedUrl: string,
  plan: string = "free"
): Promise<string[]> {
  const limit = getPageLimitForPlan(plan);
  const origin = new URL(normalizeUrl(seedUrl)).origin;
  const sitemapCandidates = [
    `${origin}/sitemap.xml`,
    `${origin}/sitemap_index.xml`,
  ];

  for (const sitemapUrl of sitemapCandidates) {
    try {
      await assertSafeUrl(sitemapUrl);
      const res = await fetchWithRedirects(sitemapUrl);
      if (!res.ok) continue;

      const xml = await res.text();
      const $ = cheerio.load(xml, { xmlMode: true });
      const urls: string[] = [];

      $("url loc, sitemap loc").each((_, el) => {
        const loc = $(el).text().trim();
        if (!loc) return;
        try {
          const abs = new URL(loc, origin).toString();
          if (abs.startsWith(origin)) urls.push(abs);
        } catch {
          // skip
        }
      });

      if (urls.length > 0) {
        return [...new Set(urls)].slice(0, limit);
      }
    } catch {
      // try next candidate
    }
  }

  return discoverLinks(seedUrl, Math.min(limit, 10));
}
