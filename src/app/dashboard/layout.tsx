import Link from "next/link";
import { redirect } from "next/navigation";
import { Bot, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { logout } from "./actions";

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
    <div className="min-h-screen">
      <header className="border-b border-[var(--color-border)] bg-[var(--color-bg)]/80 backdrop-blur sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
            <Bot className="w-5 h-5 text-[var(--color-brand)]" />
            Helply
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-sm text-[var(--color-muted)] hidden sm:inline">
              {user.email}
            </span>
            <form action={logout}>
              <button className="btn btn-secondary" type="submit" title="Sign out">
                <LogOut className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">{children}</main>
    </div>
  );
}
