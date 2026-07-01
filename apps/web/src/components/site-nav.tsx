import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Menu, X } from "lucide-react";
import { LogoMark } from "@/components/logo-mark";

const navLinks = [
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "How it works", href: "#how" },
];

export function SiteNav() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className="fixed top-0 inset-x-0 z-50 transition-all duration-300 px-5 sm:px-6"
      style={{
        background: scrolled ? "transparent" : "transparent",
        paddingTop: scrolled ? "0.75rem" : "0",
      }}
    >
      <div
        className={`nav-scroll-pill max-w-5xl mx-auto h-14 flex items-center justify-between ${scrolled ? "is-scrolled" : ""}`}
        style={{
          backdropFilter: scrolled ? "blur(20px)" : "none",
          WebkitBackdropFilter: scrolled ? "blur(20px)" : "none",
        }}
      >
        <Link to="/" className="flex items-center gap-2.5 shrink-0">
          <LogoMark />
          <span className="text-[0.9375rem] font-semibold tracking-tight" style={{ color: "var(--fg)" }}>
            Ragify
          </span>
          <span
            className="hidden sm:inline-flex text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
            style={{ background: "var(--accent-muted)", color: "var(--accent-fg)" }}
          >
            Beta
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-0.5 absolute left-1/2 -translate-x-1/2">
          {navLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="nav-pill px-3.5 py-2 text-sm rounded-lg transition-colors"
              style={{ color: "var(--fg-secondary)" }}
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-1.5">
          <Link to="/login" className="btn btn-ghost hidden sm:inline-flex text-sm">
            Sign in
          </Link>
          <Link to="/login" className="btn btn-primary hidden sm:inline-flex gap-1.5 text-sm">
            Start free
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
          <button
            type="button"
            className="btn btn-ghost md:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen(!open)}
          >
            {open ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      <div
        className="md:hidden overflow-hidden transition-all duration-300 ease-out max-w-6xl mx-auto"
        style={{
          maxHeight: open ? "320px" : "0",
          opacity: open ? 1 : 0,
          borderTop: open ? "1px solid var(--border)" : "1px solid transparent",
          background: "var(--bg-elevated)",
        }}
      >
        <div className="px-5 py-4 space-y-1">
          {navLinks.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="block py-3 px-3 text-sm rounded-lg transition-colors nav-pill"
              style={{ color: "var(--fg-secondary)" }}
              onClick={() => setOpen(false)}
            >
              {l.label}
            </a>
          ))}
          <div className="pt-3 flex flex-col gap-2">
            <Link
              to="/login"
              className="btn btn-secondary w-full py-3"
              onClick={() => setOpen(false)}
            >
              Sign in
            </Link>
            <Link
              to="/login"
              className="btn btn-primary w-full py-3 gap-1.5"
              onClick={() => setOpen(false)}
            >
              Start free
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
