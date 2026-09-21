import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AppLayout } from "@/components/AppLayout";

vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("@/contexts/DemoModeContext", () => ({ useDemoMode: () => ({ isDemo: false }) }));
vi.mock("@/components/AppSidebar", () => ({ AppSidebar: () => <nav aria-label="主导航" /> }));
vi.mock("@/components/MobileNav", () => ({ MobileNav: () => null }));
vi.mock("@/components/ui/sidebar", () => ({
  SidebarProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SidebarTrigger: () => <button type="button">切换侧栏</button>,
}));

describe("AppLayout", () => {
  it("exposes the page title as the single level-one heading", () => {
    render(
      <AppLayout title="设置">
        <p>页面内容</p>
      </AppLayout>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "设置" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
  });
});
