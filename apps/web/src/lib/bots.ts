import type { Bot } from "@ragify/core/types";

function parseAllowedOriginsInput(input: string): string[] {
  return input
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((o) => {
      if (o === "*") return "*";
      if (!/^https?:\/\//i.test(o)) return `https://${o}`;
      try {
        const u = new URL(o);
        return `${u.protocol}//${u.host}`;
      } catch {
        return o.replace(/\/$/, "");
      }
    });
}

export async function fetchBots(token: string) {
  const data = await fetch("/api/bots", {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json());
  if (!data.bots) throw new Error(data.error ?? "Failed to load bots");
  return data.bots as Bot[];
}

export async function fetchBot(token: string, botId: string) {
  const data = await fetch(`/api/bots/${botId}`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json());
  if (!data.bot) throw new Error(data.error ?? "Bot not found");
  return data.bot as Bot;
}

export async function fetchBotSources(token: string, botId: string) {
  const data = await fetch(`/api/bots/${botId}/sources`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json());
  return {
    sources: data.sources ?? [],
    chunkCount: typeof data.chunkCount === "number" ? data.chunkCount : 0,
  };
}

export async function fetchCrawlJobs(token: string, botId: string) {
  const data = await fetch(`/api/bots/${botId}/crawl-jobs`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then((r) => r.json());
  return data.jobs ?? [];
}

export async function createBot(token: string, name: string, url?: string) {
  const res = await fetch("/api/bots", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(url ? { name, url } : { name }),
  });
  const data = await res.json();
  if (!res.ok) return { error: data.error ?? "Failed to create bot." };
  return { bot: data.bot as Bot };
}

export async function deleteBot(token: string, botId: string) {
  const res = await fetch(`/api/bots/${botId}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    return { error: data.error ?? "Delete failed" };
  }
  return { success: true };
}

export async function updateBot(
  token: string,
  botId: string,
  data: {
    name: string;
    welcome_message: string;
    primary_color: string;
    system_prompt: string;
    allowed_origins?: string;
  }
) {
  const res = await fetch(`/api/bots/${botId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      ...data,
      allowed_origins: data.allowed_origins
        ? parseAllowedOriginsInput(data.allowed_origins).join("\n")
        : undefined,
    }),
  });
  const json = await res.json();
  if (!res.ok) return { error: json.error ?? "Update failed" };
  return { success: true };
}

export async function crawlRequest(
  token: string,
  body: Record<string, unknown>
) {
  const res = await fetch("/api/crawl", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { error: data.error ?? "Crawl failed" };
  return data;
}

export async function addTextSource(
  token: string,
  botId: string,
  title: string,
  content: string
) {
  const res = await fetch("/api/sources/text", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ botId, title, content }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { error: data.error ?? "Failed to add text" };
  return data;
}

export async function uploadPdfSource(token: string, botId: string, file: File) {
  const form = new FormData();
  form.append("botId", botId);
  form.append("file", file);

  const res = await fetch("/api/sources/pdf", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { error: data.error ?? "PDF upload failed" };
  return data;
}

export async function reindexSource(token: string, botId: string, sourceId: string) {
  const res = await fetch("/api/sources/reindex", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ botId, sourceId }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { error: data.error ?? "Re-index failed" };
  return data;
}

export async function startCheckout(token: string, plan: "starter" | "pro") {
  const res = await fetch("/api/billing/checkout", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ plan }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Checkout failed");
  return data.url as string;
}

export async function openBillingPortal(token: string) {
  const res = await fetch("/api/billing/portal", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Portal failed");
  return data.url as string;
}
