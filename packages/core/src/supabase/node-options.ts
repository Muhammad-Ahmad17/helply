import type { SupabaseClientOptions } from "@supabase/supabase-js";
import ws from "ws";

/** Supabase client options for Node.js services (Docker / Hono). */
export function nodeSupabaseOptions(
  overrides?: SupabaseClientOptions<"public">
): SupabaseClientOptions<"public"> {
  return {
    ...overrides,
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      ...overrides?.auth,
    },
    realtime: {
      transport: ws as unknown as typeof WebSocket,
      ...overrides?.realtime,
    },
  };
}
