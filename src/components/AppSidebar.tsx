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
  Target,
  Lightbulb,
  Settings,
  Scale,
  LogOut,
  Kanban,
  BookOpen,
  ShoppingBag,
  Sparkles,
  GraduationCap,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { LangToggle } from "@/components/LangToggle";
import { POINTS_FEATURE_ENABLED } from "@/lib/featureFlags";
import { useLang } from "@/contexts/LanguageContext";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSettings } from "@/hooks/useData";
import { useDemoMode } from "@/contexts/DemoModeContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { signOut } = useAuth();
  const { isDemo } = useDemoMode();
  const { t } = useLang();
  const { data: settings } = useSettings();
  const hiddenFeatures = settings?.hidden_features || [];
  const focusMode = (settings as any)?.app_focus_mode || "full";

  /* Groups mirror the ⌘K palette's taxonomy (今天/生活/成长) so both
     navigations teach the same mental model. */
  const navGroups: Array<{ label: string; items: Array<{ title: string; url: string; icon: React.ElementType }> }> = [
    {
      label: t("今天", "Today"),
      items: [
        { title: t("首页概览", "Dashboard"), url: "/", icon: LayoutDashboard },
        { title: t("日程计划", "Schedule"), url: "/schedule", icon: CalendarDays },
        { title: t("待办事项", "To-Dos"), url: "/todos", icon: CheckSquare },
        { title: t("今日待办", "Today's Todo"), url: "/today", icon: CalendarCheck },
      ],
    },
    {
      label: t("生活", "Life"),
      items: [
        { title: t("记账", "Finance"), url: "/finance", icon: Wallet },
        { title: t("热量记录", "Calories"), url: "/calories", icon: Flame },
        { title: t("食材管理", "Pantry"), url: "/pantry", icon: Carrot },
        { title: t("用品管理", "Belongings"), url: "/belongings", icon: Package },
        { title: t("生活日报", "Newspapers"), url: "/newspapers", icon: Newspaper },
      ],
    },
    {
      label: t("成长", "Growth"),
      items: [
        { title: t("项目管理", "Projects"), url: "/projects", icon: Kanban },
        { title: t("目标", "Goals"), url: "/goals", icon: Target },
        { title: t("随想", "Thoughts"), url: "/thoughts", icon: Lightbulb },
        { title: t("学习笔记", "Learning Notes"), url: "/learning-notes", icon: BookOpen },
        { title: t("减肥专项", "Weight Loss"), url: "/weight-loss", icon: Scale },
        { title: t("考公", "Civil Service"), url: "/civil-service", icon: GraduationCap },
        { title: t("运势", "Fortune"), url: "/fortune", icon: Sparkles },
      ],
    },
  ];

  const visibleGroups = navGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        if (focusMode === "civil_service") {
          return item.url === "/civil-service";
        }
        const key = item.url.replace("/", "");
        return !hiddenFeatures.includes(key);
      }),
    }))
    .filter((group) => group.items.length > 0);

  return (
    <Sidebar
      collapsible="icon"
      role="navigation"
      aria-label={t("主导航", "Main navigation")}
      className={`border-r border-border bg-background ${isDemo ? "md:top-10 md:h-[calc(100svh-2.5rem)]" : ""}`}
    >
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <img src="/v-life-icon.svg" alt="V-Life" className="h-8 w-8 rounded-lg shrink-0" />
          {!collapsed && (
            <span className="text-base font-semibold text-foreground tracking-tight">
              V-Life
            </span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="[scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {visibleGroups.map((group) => (
          <SidebarGroup key={group.label} className="py-1">
            <SidebarGroupLabel className="text-[11px] font-medium tracking-wide">{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton asChild tooltip={item.title}>
                      <NavLink
                        to={item.url}
                        end={item.url === "/"}
                        className="text-muted-foreground hover:bg-muted hover:text-foreground transition-colors rounded-md"
                        activeClassName="bg-muted text-foreground font-medium"
                      >
                        <item.icon className="h-4 w-4 shrink-0" />
                        {!collapsed && <span>{item.title}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-border">
        <SidebarMenu>
          <SidebarMenuItem>
            {POINTS_FEATURE_ENABLED && focusMode !== "civil_service" && (
              <SidebarMenuButton asChild tooltip={t("商店", "Shop")}>
                <NavLink
                  to="/shop"
                  className="text-muted-foreground hover:bg-muted hover:text-foreground transition-colors rounded-md"
                  activeClassName="bg-muted text-foreground font-medium"
                >
                  <ShoppingBag className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>{t("商店", "Shop")}</span>}
                </NavLink>
              </SidebarMenuButton>
            )}
          </SidebarMenuItem>
          <SidebarMenuItem>
            <LangToggle collapsed={collapsed} />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip={t("设置", "Settings")}>
              <NavLink
                to="/settings"
                className="text-muted-foreground hover:bg-muted hover:text-foreground transition-colors rounded-md"
                activeClassName="bg-muted text-foreground font-medium"
              >
                <Settings className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{t("设置", "Settings")}</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          {!isDemo && (
            <SidebarMenuItem>
              <SidebarMenuButton tooltip={t("退出登录", "Log out")} onClick={signOut}>
                <LogOut className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{t("退出登录", "Log out")}</span>}
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
