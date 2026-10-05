import {
  Newspaper,
  LayoutDashboard,
  Carrot,
  Package,
  CalendarDays,
  Flame,
  Wallet,
  CheckSquare,
  CalendarCheck,
  Lightbulb,
  Target,
  Settings,
  MoreHorizontal,
  Scale,
  LogOut,
  Languages,
  BookOpen,
  ShoppingBag,
  Sparkles,
  GraduationCap,
  X,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useState, useEffect, useRef, useId, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { AnimatePresence, LayoutGroup, motion, useIsPresent, useReducedMotion } from "motion/react";
import { motionTokens } from "@/lib/motion-tokens";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LanguageContext";
import { useSettings } from "@/hooks/useData";
import { POINTS_FEATURE_ENABLED } from "@/lib/featureFlags";

function MobileMenuLayer({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  const present = useIsPresent();
  const reduced = useReducedMotion();
  return <motion.div key="more-menu" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduced ? 0 : .16 }} className="fixed inset-0 z-[60] bg-background/80 backdrop-blur-sm md:hidden" onClick={onClose} role="presentation" aria-hidden={!present} inert={!present}>{children}</motion.div>;
}

export function MobileNav() {
  const [showMore, setShowMore] = useState(false);
  const reduced = useReducedMotion();
  const { pathname } = useLocation();
  const navGroupId = useId();
  const { signOut } = useAuth();
  const { t, lang, toggleLang } = useLang();
  const { data: settings } = useSettings();
  const hiddenFeatures = settings?.hidden_features || [];
  const focusMode = (settings as any)?.app_focus_mode || "full";
  const morePanelId = useId();
  const moreButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const primaryItems = focusMode === "civil_service"
    ? [
        { title: t("考公", "Civil"), url: "/civil-service", icon: GraduationCap },
        { title: t("设置", "Settings"), url: "/settings", icon: Settings },
      ]
    : [
        { title: t("首页", "Home"), url: "/", icon: LayoutDashboard },
        { title: t("日程", "Schedule"), url: "/schedule", icon: CalendarDays },
        { title: t("记账", "Finance"), url: "/finance", icon: Wallet },
        { title: t("待办", "To-Do"), url: "/todos", icon: CheckSquare },
      ];

  const moreItems = [
    { title: t("生活日报", "Newspapers"), url: "/newspapers", icon: Newspaper },
    { title: t("食材管理", "Pantry"), url: "/pantry", icon: Carrot },
    { title: t("用品管理", "Belongings"), url: "/belongings", icon: Package },
    { title: t("热量记录", "Calories"), url: "/calories", icon: Flame },
    { title: t("目标", "Goals"), url: "/goals", icon: Target },
    { title: t("随想", "Thoughts"), url: "/thoughts", icon: Lightbulb },
    { title: t("今日待办", "Today"), url: "/today", icon: CalendarCheck },
    { title: t("学习笔记", "Learning Notes"), url: "/learning-notes", icon: BookOpen },
    { title: t("减肥", "Weight"), url: "/weight-loss", icon: Scale },
    { title: t("考公", "Civil Service"), url: "/civil-service", icon: GraduationCap },
    { title: t("运势", "Fortune"), url: "/fortune", icon: Sparkles },
    ...(POINTS_FEATURE_ENABLED ? [{ title: t("商店", "Shop"), url: "/shop", icon: ShoppingBag }] : []),
    { title: t("设置", "Settings"), url: "/settings", icon: Settings },
  ];

  const visiblePrimaryItems = primaryItems.filter((item) => {
    if (focusMode === "civil_service") return true;
    const key = item.url.replace("/", "");
    return !hiddenFeatures.includes(key);
  });

  const visibleMoreItems = moreItems.filter((item) => {
    if (focusMode === "civil_service") {
      return item.url === "/civil-service" || item.url === "/settings";
    }
    const key = item.url.replace("/", "");
    return !hiddenFeatures.includes(key);
  });
  const moreActive = showMore || !visiblePrimaryItems.some(item => item.url === "/" ? pathname === "/" : pathname === item.url || pathname.startsWith(`${item.url}/`));
  const closeMore = () => {
    setShowMore(false);
    moreButtonRef.current?.focus();
  };

  useEffect(() => {
    if (!showMore) return;

    const panel = panelRef.current;
    const focusables = () =>
      Array.from(
        panel?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) ?? []
      ).filter((el) => el.offsetParent !== null);

    const first = focusables()[0];
    first?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setShowMore(false);
        moreButtonRef.current?.focus();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const items = focusables();
      if (items.length === 0) return;
      const firstEl = items[0];
      const lastEl = items[items.length - 1];
      if (e.shiftKey && document.activeElement === firstEl) {
        e.preventDefault();
        lastEl.focus();
      } else if (!e.shiftKey && document.activeElement === lastEl) {
        e.preventDefault();
        firstEl.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showMore]);

  return (
    <>
      {/* More panel overlay */}
      <AnimatePresence>
      {showMore && (
        <MobileMenuLayer key="more-menu" onClose={closeMore}>
          <motion.div
            ref={panelRef}
            id={morePanelId}
            role="dialog"
            aria-modal="true"
            aria-label={t("更多功能菜单", "More features menu")}
            initial={{ y: 24 }} animate={{ y: 0 }} exit={{ y: 16 }}
            transition={reduced ? { duration: 0 } : motionTokens.spring.responsive}
            className="mobile-more-panel absolute bottom-16 left-0 right-0 max-h-[calc(100dvh-6rem)] overflow-y-auto rounded-t-lg bg-card border border-border p-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between border-b border-border pb-2">
              <h2 className="text-sm font-semibold">{t("更多功能", "More features")}</h2>
              <button type="button" aria-label={t("关闭更多菜单", "Close more menu")} className="paper-button inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={closeMore}><X className="h-4 w-4" /></button>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {visibleMoreItems.map((item) => (
                <NavLink
                  key={item.url}
                  to={item.url}
                  end={item.url === "/"}
                  className="paper-button min-h-16 flex flex-col items-center justify-center gap-1.5 p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  activeClassName="bg-muted text-foreground"
                  onClick={() => setShowMore(false)}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="text-xs">{item.title}</span>
                </NavLink>
              ))}
              <button
                type="button"
                onClick={toggleLang}
                className="min-h-16 flex flex-col items-center justify-center gap-1 p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                <Languages className="h-5 w-5" />
                <span className="text-xs">{lang === "zh" ? "EN" : "中文"}</span>
              </button>
              <button
                type="button"
                onClick={signOut}
                className="min-h-16 flex flex-col items-center justify-center gap-1 p-2 rounded-lg text-destructive hover:bg-muted hover:text-destructive/80 transition-colors"
              >
                <LogOut className="h-5 w-5" />
                <span className="text-xs">{t("退出", "Exit")}</span>
              </button>
            </div>
          </motion.div>
        </MobileMenuLayer>
      )}
      </AnimatePresence>

      {/* Bottom nav bar */}
      <nav aria-label={t("移动主导航", "Mobile navigation")} className={cn("fixed bottom-0 left-0 right-0 bg-card border-t border-border md:hidden", showMore ? "z-[70]" : "z-50")}>
        <LayoutGroup id={navGroupId}>
        <div className="relative isolate flex items-center h-16 gap-1 px-2">
          {visiblePrimaryItems.map((item) => (
            <NavLink
              key={item.url}
              to={item.url}
              end={item.url === "/"}
              className="mobile-nav-item relative min-h-11 min-w-11 flex-1 flex flex-col items-center justify-center gap-0.5 rounded-lg p-1.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
              activeClassName="text-foreground font-medium"
              onClick={() => setShowMore(false)}
            >
              {({ isActive }) => <>
                {isActive && !showMore && <motion.span aria-hidden="true" layoutId="mobile-active" className="mobile-nav-surface absolute inset-0 z-0 rounded-lg bg-muted" transition={reduced ? { duration: 0 } : motionTokens.spring.responsive} />}
                <item.icon className="relative z-10 h-5 w-5" />
                <span className="relative z-10 text-[11px]">{item.title}</span>
              </>}
            </NavLink>
          ))}
          <button
            ref={moreButtonRef}
            type="button"
            onClick={() => setShowMore(!showMore)}
            aria-expanded={showMore}
            aria-controls={morePanelId}
            aria-label={t("更多菜单", "More menu")}
            className={cn(
              "mobile-nav-item relative min-h-11 min-w-11 flex-1 flex flex-col items-center justify-center gap-0.5 rounded-lg p-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors",
              moreActive ? "text-foreground font-medium" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {moreActive && <motion.span aria-hidden="true" layoutId="mobile-active" className="mobile-nav-surface absolute inset-0 z-0 rounded-lg bg-muted" transition={reduced ? { duration: 0 } : motionTokens.spring.responsive} />}
            <MoreHorizontal className="relative z-10 h-5 w-5" />
            <span className="relative z-10 text-[11px]">{t("更多", "More")}</span>
          </button>
        </div>
        </LayoutGroup>
      </nav>
    </>
  );
}
