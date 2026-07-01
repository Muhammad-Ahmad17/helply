// Zyte Scrapy Cloud fallback for JS-heavy or blocked pages.
import * as cheerio from "cheerio";

export type FetchResult = {
  html: string;
  title: string;
  text: string;
  via: "direct" | "zyte";
};

export async function fetchViaZyte(url: string): Promise<FetchResult> {
  const apiKey = process.env.ZYTE_API_KEY;
  if (!apiKey) throw new Error("ZYTE_API_KEY is not set");

  const res = await fetch("https://api.zyte.com/v1/extract", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}`,
    },
    body: JSON.stringify({
      url,
      browserHtml: true,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Zyte fetch failed (${res.status}): ${body}`);
  }

  const json = (await res.json()) as { browserHtml?: string };
  const html = json.browserHtml ?? "";
  const $ = cheerio.load(html);
  $("script, style, nav, footer, header, noscript").remove();
  const title = $("title").text().trim() || url;
  const text = $("body").text().replace(/\s+/g, " ").trim();

  return { html, title, text, via: "zyte" };
}

export function shouldUseZyteFallback(
  directText: string,
  statusCode: number
): boolean {
  if (!process.env.ZYTE_API_KEY) return false;
  if (statusCode === 403 || statusCode === 429) return true;
  if (directText.trim().length < 100) return true;
  return false;
}
