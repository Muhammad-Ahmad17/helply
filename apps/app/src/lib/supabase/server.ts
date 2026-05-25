// Server-side Supabase client bound to the current request's cookies.
// Use this in Server Components, Route Handlers, and Server Actions.
// It respects RLS — queries run as the logged-in user.
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll throws inside read-only contexts (e.g. Server Components).
            // Middleware refreshes the session, so this is safe to ignore here.
          }
        },
      },
    }
  );
}
