import Link from "next/link";

function Logo() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect width="24" height="24" rx="6" fill="var(--fg)" />
      {/* R for Ragify */}
      <path
        d="M8 7h4.5a2.5 2.5 0 0 1 0 5H8m0-5v10m4.5-5 3.5 5"
        stroke="var(--bg)"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SiteNav() {
  return (
    <header
      className="fixed top-0 inset-x-0 z-50"
      style={{
        background: "color-mix(in srgb, var(--bg) 85%, transparent)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5">
          <Logo />
          <span className="text-sm font-medium" style={{ color: "var(--fg)" }}>
            Ragify
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
          <a href="#features" className="btn btn-ghost">
            Features
          </a>
          <a href="#pricing" className="btn btn-ghost">
            Pricing
          </a>
          <a href="#how" className="btn btn-ghost">
            How it works
          </a>
        </nav>

        <div className="flex items-center gap-1">
          <Link href="/login" className="btn btn-ghost hidden sm:inline-flex">
            Sign in
          </Link>
          <Link href="/login" className="btn btn-primary">
            Get Started
          </Link>
        </div>
      </div>
    </header>
  );
}
