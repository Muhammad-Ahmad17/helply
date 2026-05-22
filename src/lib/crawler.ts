// Lightweight HTML crawler. Uses cheerio (jQuery-like server-side DOM) — no
// headless browser, no Puppeteer. Good for ~95% of marketing/docs sites.
// JS-rendered SPAs won't fully load this way; that's a v2 feature.
import * as cheerio from "cheerio";

const FETCH_TIMEOUT_MS = 15_000;
const MAX_BYTES = 2_000_000;
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

export async function crawlUrl(input: string): Promise<CrawlResult> {
  const url = normalizeUrl(input);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,*/*;q=0.8" },
    });
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
  } finally {
    clearTimeout(timeout);
  }
}

function extractText(url: string, html: string): CrawlResult {
  const $ = cheerio.load(html);
  for (const sel of REMOVE_SELECTORS) $(sel).remove();

  const title =
    $("title").first().text().trim() ||
    $("meta[property='og:title']").attr("content") ||
    new URL(url).hostname;

  // Prefer <main> or <article> if present, fall back to <body>.
  const root = $("main").length ? $("main") : $("article").length ? $("article") : $("body");

  // Insert newlines between block elements so paragraphs aren't smashed together.
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

/**
 * Best-effort discovery of additional URLs from a single page.
 * Returns at most `limit` same-origin links, ranked by appearance order.
 * For v1 we use this lightly — full sitemap crawl is a v2 feature.
 */
export async function discoverLinks(seedUrl: string, limit = 10): Promise<string[]> {
  const url = normalizeUrl(seedUrl);
  const origin = new URL(url).origin;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT },
    });
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
