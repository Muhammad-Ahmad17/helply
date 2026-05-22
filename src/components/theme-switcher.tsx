"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme, type ThemeSetting } from "@/app/theme-provider";

const options: { id: ThemeSetting; label: string; icon: React.ReactNode }[] = [
  { id: "system", label: "System", icon: <Monitor className="w-3.5 h-3.5" /> },
  { id: "light", label: "Light", icon: <Sun className="w-3.5 h-3.5" /> },
  { id: "dark", label: "Dark", icon: <Moon className="w-3.5 h-3.5" /> },
];

export function ThemeSwitcher() {
  const { setting, setSetting } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div
        className="h-8 w-[120px] rounded-lg shrink-0"
        style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}
        aria-hidden
      />
    );
  }

  return (
    <div
      className="inline-flex items-center gap-0.5 p-0.5 rounded-lg shrink-0"
      style={{ background: "var(--bg-subtle)", border: "1px solid var(--border)" }}
      role="group"
      aria-label="Theme"
    >
      {options.map((opt) => {
        const active = setting === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => setSetting(opt.id)}
            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer"
            style={
              active
                ? {
                    background: "var(--card)",
                    color: "var(--fg)",
                    boxShadow: "0 1px 2px var(--glow)",
                  }
                : { color: "var(--fg-muted)", background: "transparent" }
            }
            aria-pressed={active}
            title={opt.label}
          >
            {opt.icon}
            <span className="hidden sm:inline">{opt.label}</span>
          </button>
        );
      })}
    </div>
  );
}
