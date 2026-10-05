import { act, fireEvent, render, screen } from "@testing-library/react";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { lazy, useEffect } from "react";
import { AppLayout, AppShell } from "@/components/AppLayout";
import { routeSkeletonSpec } from "@/components/routeSkeletons";

const layout = vi.hoisted(() => ({ mobile: false, navMounts: 0 }));
beforeEach(() => { layout.mobile = false; layout.navMounts = 0; });
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => layout.mobile }));
vi.mock("@/contexts/DemoModeContext", () => ({ useDemoMode: () => ({ isDemo: false }) }));
vi.mock("@/components/AppSidebar", () => ({ AppSidebar: () => {
  useEffect(() => { layout.navMounts += 1; }, []);
  return <nav aria-label="主导航"><Link to="/schedule">打开日程</Link></nav>;
} }));
vi.mock("@/components/MobileNav", () => ({ MobileNav: () => <nav aria-label="手机导航" /> }));
vi.mock("@/components/arc/AppCommandPalette", () => ({ AppCommandPalette: () => null }));
vi.mock("@/components/ui/sidebar", () => ({
  SidebarProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SidebarTrigger: () => <button type="button">切换侧栏</button>,
}));

function PendingPage() {
  if (typeof window !== "undefined") throw new Promise(() => {});
  return null;
}

function renderShell(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path={path} element={<PendingPage />} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("route skeletons", () => {
  it("gives each page its own skeleton", () => {
    expect(routeSkeletonSpec("/").kind).toBe("dashboard");
    expect(routeSkeletonSpec("/schedule").kind).toBe("schedule");
    expect(routeSkeletonSpec("/todos").kind).toBe("todos");
    expect(routeSkeletonSpec("/today").kind).toBe("today");
    expect(routeSkeletonSpec("/finance").kind).toBe("finance");
    expect(routeSkeletonSpec("/projects").kind).toBe("workspace");
    expect(routeSkeletonSpec("/learning-notes").fullBleed).toBe(true);
    expect(routeSkeletonSpec("/fortune").kind).toBe("fortune");
    expect(routeSkeletonSpec("/fortune/tarot").kind).toBe("fortune-reading");
    expect(routeSkeletonSpec("/civil-service/xingce").kind).toBe("civil-group");
    expect(routeSkeletonSpec("/settings").kind).not.toBe(routeSkeletonSpec("/pantry").kind);
  });
});

describe("AppShell", () => {
  it("keeps the same navigation through a slow route change and replaces the skeleton when ready", async () => {
    let finish!: (module: { default: () => React.ReactNode }) => void;
    const NextPage = lazy(() => new Promise<{ default: () => React.ReactNode }>(resolve => { finish = resolve; }));
    render(<MemoryRouter initialEntries={["/"]}><Routes><Route element={<AppShell />}>
      <Route path="/" element={<AppLayout title="首页"><p>首页内容</p></AppLayout>} />
      <Route path="/schedule" element={<NextPage />} />
    </Route></Routes></MemoryRouter>);
    const navigation = screen.getByRole("navigation", { name: "主导航" });
    fireEvent.click(screen.getByRole("link", { name: "打开日程" }));
    expect(await screen.findByRole("status", { name: "正在加载日程" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "主导航" })).toBe(navigation);
    await act(async () => finish({ default: () => <AppLayout title="日程"><p>日程内容</p></AppLayout> }));
    expect(screen.getByText("日程内容")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "主导航" })).toBe(navigation);
    expect(layout.navMounts).toBe(1);
  });

  it("retains mobile navigation while content is loading", () => {
    layout.mobile = true;
    renderShell("/today");
    expect(screen.getByRole("navigation", { name: "手机导航" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "正在加载今日待办" })).toHaveAttribute("aria-busy", "true");
  });

  it("keeps the sidebar mounted and skeletons only the content while a page loads", () => {
    renderShell("/schedule");

    expect(screen.getByRole("navigation", { name: "主导航" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "切换侧栏" })).toBeInTheDocument();
    const status = screen.getByRole("status", { name: "正在加载日程" });
    expect(status).toHaveAttribute("data-skeleton", "schedule");
    expect(status.closest("main")).not.toBeNull();
  });

  it("uses a different skeleton for the dashboard", () => {
    renderShell("/");

    expect(screen.getByRole("navigation", { name: "主导航" })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "正在加载首页" })).toHaveAttribute("data-skeleton", "dashboard");
  });
});
