import {
  LayoutDashboard,
  Carrot,
  Package,
  CalendarDays,
  Flame,
  Wallet,
  CheckSquare,
  Lightbulb,
  Target,
  Settings,
  MoreHorizontal,
  Scale,
  LogOut,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";

const primaryItems = [
  { title: "首页", url: "/", icon: LayoutDashboard },
  { title: "日程", url: "/schedule", icon: CalendarDays },
  { title: "记账", url: "/finance", icon: Wallet },
  { title: "待办", url: "/todos", icon: CheckSquare },
];

const moreItems = [
  { title: "食材管理", url: "/pantry", icon: Carrot },
  { title: "用品管理", url: "/belongings", icon: Package },
  { title: "热量记录", url: "/calories", icon: Flame },
  { title: "目标", url: "/goals", icon: Target },
  { title: "随想", url: "/thoughts", icon: Lightbulb },
  { title: "减肥", url: "/weight-loss", icon: Scale },
  { title: "设置", url: "/settings", icon: Settings },
];

export function MobileNav() {
  const [showMore, setShowMore] = useState(false);
  const { signOut } = useAuth();

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
            <span className="text-[10px]">更多</span>
          </button>
        </div>
      </nav>
    </>
  );
}
