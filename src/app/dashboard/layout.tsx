import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "./actions";
import { SiteFooter } from "@/components/site-footer";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
      <header
        className="sticky top-0 z-50 flex items-center justify-between px-5 h-14"
        style={{
          background: "color-mix(in srgb, var(--bg) 90%, transparent)",
          backdropFilter: "blur(12px)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <Link href="/dashboard" className="text-sm font-medium" style={{ color: "var(--fg)" }}>
          Helply
        </Link>
        <div className="flex items-center gap-2">
          <span className="text-xs hidden sm:inline" style={{ color: "var(--fg-muted)" }}>
            {user.email}
          </span>
          <form action={logout}>
            <button type="submit" className="btn btn-ghost text-xs">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-5 py-10">{children}</main>

      <SiteFooter />
    </div>
  );
}
