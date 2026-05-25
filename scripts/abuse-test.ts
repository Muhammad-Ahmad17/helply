#!/usr/bin/env npx tsx
/**
 * Abuse / security smoke tests against a deployed Ragify instance.
 *
 * Usage:
 *   BASE_URL=https://ragify.tech npx tsx scripts/abuse-test.ts
 *   BASE_URL=https://ragify.tech BOT_ID=<uuid> npx tsx scripts/abuse-test.ts
 */
const BASE = process.env.BASE_URL ?? "https://ragify.tech";
const BOT_ID = process.env.BOT_ID ?? "00000000-0000-0000-0000-000000000001";

let passed = 0;
let failed = 0;

function ok(name: string) {
  console.log(`  ✓ ${name}`);
  passed++;
}

function fail(name: string, detail: string) {
  console.log(`  ✗ ${name}: ${detail}`);
  failed++;
}

async function testCrawl502() {
  const res = await fetch(`${BASE}/api/crawl`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ botId: BOT_ID, url: "https://example.com" }),
  });
  if (res.status === 502) fail("crawl reachable", "502 Bad Gateway — VM2 firewall or crawl-api down");
  else if (res.status === 401) ok("crawl requires auth (not 502)");
  else ok(`crawl returned ${res.status} (not 502)`);
}

async function testCrawlSsrf() {
  const res = await fetch(`${BASE}/api/crawl`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer invalid-token-for-ssrf-test",
    },
    body: JSON.stringify({
      botId: BOT_ID,
      url: "http://169.254.169.254/latest/meta-data/",
    }),
  });
  if (res.status === 400 || res.status === 401) ok("SSRF blocked or auth required");
  else fail("SSRF blocked", `expected 400/401 got ${res.status}`);
}

async function testChatRateLimit() {
  let hits429 = 0;
  for (let i = 0; i < 40; i++) {
    const res = await fetch(`${BASE}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        botId: BOT_ID,
        visitorId: `abuse-test-${i}`,
        messages: [{ role: "user", content: "hi" }],
      }),
    });
    if (res.status === 429) hits429++;
  }
  if (hits429 > 0) ok(`chat rate limit triggered (${hits429}× 429)`);
  else console.log("  ~ chat rate limit not triggered (Redis may be disabled)");
}

async function testLoginThrottle() {
  const res = await fetch(`${BASE}/api/auth/login-check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "abuse-test@example.com" }),
  });
  if (res.status === 200 || res.status === 429) ok(`login-check returned ${res.status}`);
  else fail("login-check", `unexpected ${res.status}`);
}

async function testBotsApi() {
  const res = await fetch(`${BASE}/api/bots/${BOT_ID}`);
  if (res.status === 500) fail("bots api", "500 — check chat-api Supabase env");
  else ok(`bots api returned ${res.status}`);
}

async function main() {
  console.log(`Abuse tests → ${BASE}\n`);
  await testCrawl502();
  await testCrawlSsrf();
  await testChatRateLimit();
  await testLoginThrottle();
  await testBotsApi();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
