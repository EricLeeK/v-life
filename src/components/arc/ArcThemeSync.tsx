import { useEffect } from "react";
import { useTheme } from "next-themes";

/** Keeps upstream CSS Modules' root theme selectors aligned with V-Life's theme. */
export function ArcThemeSync() {
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme === "dark" ? "dark" : "light";
  }, [resolvedTheme]);
  return null;
}
