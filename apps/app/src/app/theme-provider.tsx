"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { THEME_STORAGE_KEY } from "@/lib/theme-constants";

export type ThemeSetting = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

function resolveTheme(setting: ThemeSetting): ResolvedTheme {
  if (setting === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return setting;
}

function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(resolved);
  root.style.colorScheme = resolved;
}

const ThemeContext = createContext<{
  setting: ThemeSetting;
  resolved: ResolvedTheme;
  setSetting: (s: ThemeSetting) => void;
}>({
  setting: "system",
  resolved: "dark",
  setSetting: () => {},
});

export function useTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [setting, setSettingState] = useState<ThemeSetting>("system");
  const [resolved, setResolved] = useState<ResolvedTheme>("dark");
  const [mounted, setMounted] = useState(false);

  const setSetting = useCallback((next: ThemeSetting) => {
    setSettingState(next);
    localStorage.setItem(THEME_STORAGE_KEY, next);
    const r = resolveTheme(next);
    setResolved(r);
    applyTheme(r);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(THEME_STORAGE_KEY) as ThemeSetting | null;
    const initial =
      stored === "light" || stored === "dark" || stored === "system"
        ? stored
        : "system";
    setSettingState(initial);
    const r = resolveTheme(initial);
    setResolved(r);
    applyTheme(r);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || setting !== "system") return;

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const r = resolveTheme("system");
      setResolved(r);
      applyTheme(r);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [mounted, setting]);

  const value = useMemo(
    () => ({ setting, resolved, setSetting }),
    [setting, resolved, setSetting]
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export { applyTheme, resolveTheme };
