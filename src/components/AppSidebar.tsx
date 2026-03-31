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
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
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

const mainItems = [
  { title: "首页概览", url: "/", icon: LayoutDashboard },
  { title: "食材管理", url: "/pantry", icon: Carrot },
  { title: "用品管理", url: "/belongings", icon: Package },
  { title: "日程计划", url: "/schedule", icon: CalendarDays },
  { title: "热量记录", url: "/calories", icon: Flame },
  { title: "记账", url: "/finance", icon: Wallet },
  { title: "待办事项", url: "/todos", icon: CheckSquare },
  { title: "随想", url: "/thoughts", icon: Lightbulb },
  { title: "减肥专项", url: "/weight-loss", icon: Scale },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm shrink-0">
            V
          </div>
          {!collapsed && (
            <span className="text-base font-semibold text-foreground tracking-tight">
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
                      className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                      activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
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
            <SidebarMenuButton asChild tooltip="设置">
              <NavLink
                to="/settings"
                className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
              >
                <Settings className="h-4 w-4 shrink-0" />
                {!collapsed && <span>设置</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
