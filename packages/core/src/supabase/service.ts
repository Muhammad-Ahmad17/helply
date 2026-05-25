// Service-role Supabase client. BYPASSES RLS — never expose to the browser.
// Use this only in server code that needs to write on behalf of anonymous
// visitors (e.g. /api/chat logging conversations, /api/crawl writing chunks).
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function getSupabaseUrl(): string {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error("SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL is required.");
  }
  return url;
}

export function createServiceClient() {
  return createSupabaseClient(
    getSupabaseUrl(),
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
