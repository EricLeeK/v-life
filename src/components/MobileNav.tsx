import {
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
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LanguageContext";

export function MobileNav() {
  const [showMore, setShowMore] = useState(false);
  const { signOut } = useAuth();
  const { t, lang, toggleLang } = useLang();

  const primaryItems = [
    { title: t("首页", "Home"), url: "/", icon: LayoutDashboard },
    { title: t("日程", "Schedule"), url: "/schedule", icon: CalendarDays },
    { title: t("记账", "Finance"), url: "/finance", icon: Wallet },
    { title: t("待办", "To-Do"), url: "/todos", icon: CheckSquare },
  ];

  const moreItems = [
    { title: t("食材管理", "Pantry"), url: "/pantry", icon: Carrot },
    { title: t("用品管理", "Belongings"), url: "/belongings", icon: Package },
    { title: t("热量记录", "Calories"), url: "/calories", icon: Flame },
    { title: t("目标", "Goals"), url: "/goals", icon: Target },
    { title: t("随想", "Thoughts"), url: "/thoughts", icon: Lightbulb },
    { title: t("今日待办", "Today"), url: "/today", icon: CalendarCheck },
    { title: t("学习笔记", "Learning Notes"), url: "/learning-notes", icon: BookOpen },
    { title: t("减肥", "Weight"), url: "/weight-loss", icon: Scale },
    { title: t("设置", "Settings"), url: "/settings", icon: Settings },
  ];

  return (
    <>
      {/* More panel overlay */}
      {showMore && (
        <div className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden" onClick={() => setShowMore(false)}>
          <div className="absolute bottom-16 left-0 right-0 bg-card border-t border-border p-4" onClick={e => e.stopPropagation()}>
            <div className="grid grid-cols-5 gap-3">
              {moreItems.map((item) => (
                <NavLink
                  key={item.url}
                  to={item.url}
                  end={item.url === "/"}
                  className="flex flex-col items-center gap-1 p-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
                  activeClassName="text-primary"
                >
                  <item.icon className="h-5 w-5" />
                  <span className="text-[10px]">{item.title}</span>
                </NavLink>
              ))}
              <button
                onClick={toggleLang}
                className="flex flex-col items-center gap-1 p-2 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
              >
                <Languages className="h-5 w-5" />
                <span className="text-[10px]">{lang === "zh" ? "EN" : "中文"}</span>
              </button>
              <button
                onClick={signOut}
                className="flex flex-col items-center gap-1 p-2 rounded-lg text-destructive hover:text-destructive/80 transition-colors"
              >
                <LogOut className="h-5 w-5" />
                <span className="text-[10px]">{t("退出", "Exit")}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bottom nav bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border md:hidden">
        <div className="flex items-center justify-around h-14">
          {primaryItems.map((item) => (
            <NavLink
              key={item.url}
              to={item.url}
              end={item.url === "/"}
              className="flex flex-col items-center gap-0.5 p-1.5 text-muted-foreground hover:text-foreground transition-colors"
              activeClassName="text-primary"
            >
              <item.icon className="h-5 w-5" />
              <span className="text-[10px]">{item.title}</span>
            </NavLink>
          ))}
          <button
            onClick={() => setShowMore(!showMore)}
            className={cn(
              "flex flex-col items-center gap-0.5 p-1.5 transition-colors",
              showMore ? "text-primary" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <MoreHorizontal className="h-5 w-5" />
            <span className="text-[10px]">{t("更多", "More")}</span>
          </button>
        </div>
      </nav>
    </>
  );
}
