import Link from "next/link";
import { ThemeSwitcher } from "@/components/theme-switcher";

const columns = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "/#features" },
      { label: "Pricing", href: "/#pricing" },
      { label: "How it works", href: "/#how" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Documentation", href: "/#how" },
      { label: "Dashboard", href: "/dashboard" },
      { label: "Sign in", href: "/login" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "Get started", href: "/login" },
      { label: "Privacy", href: "#" },
      { label: "Terms", href: "#" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer style={{ borderTop: "1px solid var(--border)", background: "var(--bg)" }}>
      <div className="max-w-6xl mx-auto px-5 py-14">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 mb-12">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="text-sm font-medium" style={{ color: "var(--fg)" }}>
              Ragify
            </Link>
            <p className="text-xs mt-3 leading-relaxed max-w-[200px]" style={{ color: "var(--fg-muted)" }}>
              Turn any website into an AI assistant. Embed anywhere in seconds.
            </p>
          </div>

          {columns.map((col) => (
            <div key={col.title}>
              <p className="text-xs font-medium mb-3" style={{ color: "var(--fg-secondary)" }}>
                {col.title}
              </p>
              <ul className="space-y-2">
                {col.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-xs transition-colors hover:underline"
                      style={{ color: "var(--fg-muted)" }}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div
          className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pt-8"
          style={{ borderTop: "1px solid var(--border)" }}
        >
          <p className="text-xs" style={{ color: "var(--fg-muted)" }}>
            &copy; {new Date().getFullYear()} Ragify. All rights reserved.
          </p>
          <ThemeSwitcher />
        </div>
      </div>
    </footer>
  );
}
