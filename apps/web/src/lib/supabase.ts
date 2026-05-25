import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabaseConfigured = Boolean(url && anonKey);

if (!supabaseConfigured) {
  console.error(
    "[supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY — OAuth will not work. " +
      "Set them in deploy/vm1/.env and rebuild web-static."
  );
}

export const supabase = createClient(url ?? "", anonKey ?? "", {
  auth: {
    flowType: "pkce",
    // Callback page calls exchangeCodeForSession explicitly; auto-detect races and drops ?code=
    detectSessionInUrl: false,
    persistSession: true,
    autoRefreshToken: true,
  },
});

export async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ?? null;
}
