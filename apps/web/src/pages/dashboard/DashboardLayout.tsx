import { Outlet, Link, useLocation, useParams } from "react-router-dom";
import { SignedIn, SignedOut, RedirectToSignIn, UserButton, useUser } from "@clerk/clerk-react";
import { Plus, ArrowLeft } from "lucide-react";
import { SiteFooter } from "@/components/site-footer";
import { LogoMark } from "@/components/logo-mark";

export default function DashboardLayout() {
  const { user } = useUser();
  const location = useLocation();
  const { id: botId } = useParams<{ id: string }>();
  const onBotRoute = !!botId && location.pathname.includes("/bots/") && !location.pathname.endsWith("/new");

  return (
    <>
      <SignedOut>
        <RedirectToSignIn redirectUrl="/dashboard" />
      </SignedOut>
      <SignedIn>
        <div className="min-h-screen flex flex-col" style={{ background: "var(--bg)" }}>
          <header
            className="sticky top-0 z-50 flex items-center justify-between px-5 h-14 gap-4"
            style={{
              background: "color-mix(in srgb, var(--bg) 90%, transparent)",
              backdropFilter: "blur(12px)",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div className="flex items-center gap-3 min-w-0">
              {onBotRoute ? (
                <Link
                  to="/dashboard"
                  className="inline-flex items-center gap-1 text-xs shrink-0"
                  style={{ color: "var(--fg-muted)" }}
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  All bots
                </Link>
              ) : (
                <Link to="/dashboard" className="flex items-center gap-2 text-sm font-semibold shrink-0" style={{ color: "var(--fg)" }}>
                  <LogoMark size={24} />
                  Ragify
                </Link>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link to="/dashboard/bots/new" className="btn btn-primary h-8 text-xs hidden sm:inline-flex">
                <Plus className="w-3.5 h-3.5" /> New bot
              </Link>
              <span className="text-xs hidden md:inline truncate max-w-[180px]" style={{ color: "var(--fg-muted)" }}>
                {user?.primaryEmailAddress?.emailAddress}
              </span>
              <UserButton afterSignOutUrl="/" />
            </div>
          </header>
          <main className="flex-1 max-w-5xl w-full mx-auto px-5 py-10">
            <Outlet />
          </main>
          <SiteFooter />
        </div>
      </SignedIn>
    </>
  );
}
