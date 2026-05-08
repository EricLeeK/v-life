import {
  LayoutDashboard,
  Carrot,
  Package,
  CalendarDays,
  Flame,
  Wallet,
  CheckSquare,
  Target,
  Lightbulb,
  Settings,
  Scale,
  LogOut,
  Kanban,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { LangToggle } from "@/components/LangToggle";
import { useLang } from "@/contexts/LanguageContext";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
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
  const { t } = useLang();
  const mainItems = [
    { title: t("首页概览", "Dashboard"), url: "/", icon: LayoutDashboard },
    { title: t("食材管理", "Pantry"), url: "/pantry", icon: Carrot },
    { title: t("用品管理", "Belongings"), url: "/belongings", icon: Package },
    { title: t("日程计划", "Schedule"), url: "/schedule", icon: CalendarDays },
    { title: t("热量记录", "Calories"), url: "/calories", icon: Flame },
    { title: t("记账", "Finance"), url: "/finance", icon: Wallet },
    { title: t("待办事项", "To-Do"), url: "/todos", icon: CheckSquare },
    { title: t("项目管理", "Projects"), url: "/projects", icon: Kanban },
    { title: t("目标", "Goals"), url: "/goals", icon: Target },
    { title: t("随想", "Thoughts"), url: "/thoughts", icon: Lightbulb },
    { title: t("减肥专项", "Weight Loss"), url: "/weight-loss", icon: Scale },
  ];

  return (
    <Sidebar collapsible="icon" className="border-r border-[#e4e1d7] bg-white">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <img src="/v-life-icon.svg" alt="V-Life" className="h-8 w-8 rounded-lg shrink-0" />
          {!collapsed && (
            <span className="text-base font-semibold text-[#1f1a14] tracking-tight">
              V-Life
            </span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild tooltip={item.title}>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="text-[#8a847a] hover:bg-[#f4f3ee] hover:text-[#1f1a14] transition-colors rounded-md"
                      activeClassName="bg-[#f4f3ee] text-[#1f1a14] font-medium"
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
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <LangToggle collapsed={collapsed} />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip={t("设置", "Settings")}>
              <NavLink
                to="/settings"
                className="text-[#8a847a] hover:bg-[#f4f3ee] hover:text-[#1f1a14] transition-colors rounded-md"
                activeClassName="bg-[#f4f3ee] text-[#1f1a14] font-medium"
              >
                <Settings className="h-4 w-4 shrink-0" />
                {!collapsed && <span>{t("设置", "Settings")}</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip={t("退出登录", "Log out")} onClick={signOut}>
              <LogOut className="h-4 w-4 shrink-0" />
              {!collapsed && <span>{t("退出登录", "Log out")}</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
