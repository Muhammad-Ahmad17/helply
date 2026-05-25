import { createHmac, createHash } from "crypto";

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() ?? "unknown";
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "unknown";
}

export function hashIp(ip: string): string {
  return createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

export function signVisitorId(
  botId: string,
  ip: string,
  userAgent: string | null
): string {
  const secret = process.env.RATE_LIMIT_SECRET ?? "dev-insecure-secret";
  const day = new Date().toISOString().slice(0, 10);
  const uaHash = createHash("sha256")
    .update(userAgent ?? "")
    .digest("hex")
    .slice(0, 8);
  const payload = `${botId}:${ip}:${day}:${uaHash}`;
  return createHmac("sha256", secret).update(payload).digest("hex").slice(0, 32);
}

export function normalizeOrigin(origin: string): string {
  try {
    const u = new URL(origin);
    return `${u.protocol}//${u.host}`;
  } catch {
    return origin.replace(/\/$/, "");
  }
}

export function originMatchesAllowlist(
  requestOrigin: string | null,
  referer: string | null,
  allowedOrigins: string[]
): { allowed: boolean; matchedOrigin: string | null } {
  if (allowedOrigins.length === 0) {
    return { allowed: true, matchedOrigin: requestOrigin };
  }

  const candidates: string[] = [];
  if (requestOrigin) candidates.push(normalizeOrigin(requestOrigin));
  if (referer) {
    try {
      candidates.push(normalizeOrigin(new URL(referer).origin));
    } catch {
      // ignore malformed referer
    }
  }

  const normalizedAllowlist = allowedOrigins.map((o) => {
    if (o === "*") return "*";
    return normalizeOrigin(o);
  });

  if (normalizedAllowlist.includes("*")) {
    return { allowed: true, matchedOrigin: candidates[0] ?? null };
  }

  for (const candidate of candidates) {
    if (normalizedAllowlist.includes(candidate)) {
      return { allowed: true, matchedOrigin: candidate };
    }
  }

  return { allowed: false, matchedOrigin: null };
}

export function parseAllowedOriginsInput(input: string): string[] {
  return input
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((o) => {
      if (o === "*") return "*";
      if (!/^https?:\/\//i.test(o)) return `https://${o}`;
      return normalizeOrigin(o);
    });
}
