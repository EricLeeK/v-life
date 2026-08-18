import { useEffect, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useLang } from "@/contexts/LanguageContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDemoMode } from "@/contexts/DemoModeContext";

export type SettingsSection = {
  id: string;
  zh: string;
  en: string;
};

type SettingsNavProps = {
  sections: SettingsSection[];
  /** Rendered above the chips inside the sticky unit (the dirty-state save bar). */
  headerRow?: ReactNode;
};

/**
 * Sticky in-page section nav for the Settings page: grouped anchor chips with
 * scrollspy highlighting and smooth scrolling. Sticks below the app header on
 * mobile (page-level scrolling) and at the top of the content scroll container
 * on desktop.
 */
export function SettingsNav({ sections, headerRow }: SettingsNavProps) {
  const { t } = useLang();
  const isMobile = useIsMobile();
  const { isDemo } = useDemoMode();
  const [active, setActive] = useState(sections[0]?.id);

  // Desktop main is its own scroll container → stick at its top edge.
  // Mobile scrolls the page under the app header (h-12) and a 40px demo banner.
  const stickyTop = !isMobile ? 0 : isDemo ? 88 : 48;

  useEffect(() => {
    const els = sections
      .map((s) => document.getElementById(s.id))
      .filter((el): el is HTMLElement => !!el);
    if (els.length === 0) return;

    const update = () => {
      // Active = last section whose top passed the sticky unit.
      const threshold = stickyTop + 96;
      let current = els[0].id;
      for (const el of els) {
        if (el.getBoundingClientRect().top <= threshold) current = el.id;
      }
      // When the last section is fully in view, it is where the user is.
      const last = els[els.length - 1];
      if (last.getBoundingClientRect().bottom <= window.innerHeight + 4) {
        current = last.id;
      }
      setActive(current);
    };

    update();
    // Scroll events don't bubble, but capture on window catches inner scroll
    // containers (desktop main) as well as the page itself (mobile) — and,
    // unlike IntersectionObserver, delivery doesn't depend on render steps.
    window.addEventListener("scroll", update, { capture: true, passive: true });
    window.addEventListener("resize", update, { passive: true });
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [sections, stickyTop]);

  const jump = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.replaceState(null, "", `#${id}`);
  };

  return (
    <div
      className="sticky z-20 -mx-4 -mt-4 md:mx-0 md:mt-0 bg-card/90 backdrop-blur-md border-b border-border"
      style={{ top: stickyTop }}
    >
      {headerRow}
      <nav
        aria-label={t("设置分区", "Settings sections")}
        className="flex gap-1.5 overflow-x-auto scrollbar-thin px-4 md:px-6 lg:px-10 py-2"
      >
        {sections.map((s) => {
          const isActive = active === s.id;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => jump(s.id)}
              aria-current={isActive ? "true" : undefined}
              className={cn(
                "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                isActive
                  ? "bg-foreground text-background border-foreground"
                  : "bg-card/60 text-muted-foreground border-border hover:text-foreground hover:border-foreground/40",
              )}
            >
              {t(s.zh, s.en)}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
