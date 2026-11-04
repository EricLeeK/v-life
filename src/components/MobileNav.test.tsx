import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MobileNav } from "@/components/MobileNav";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ signOut: vi.fn() }),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLang: () => ({
    lang: "zh",
    t: (zh: string) => zh,
    toggleLang: vi.fn(),
  }),
}));

const settings = vi.hoisted(() => ({ hidden_features: [] as string[], app_focus_mode: "full" }));
vi.mock("@/hooks/useData", () => ({ useSettings: () => ({ data: settings }) }));
beforeEach(() => { settings.app_focus_mode = "full"; });

describe("MobileNav", () => {
  it("recovers normal navigation from retired exam-only mode", () => {
    settings.app_focus_mode = "civil_service";
    render(<MemoryRouter><MobileNav /></MemoryRouter>);
    expect(screen.getByRole("link", { name: "首页" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "更多菜单" }));
    expect(screen.getByRole("link", { name: "随想" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "学习笔记" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /考公|备考/ })).not.toBeInTheDocument();
  });

  it("provides named, thumb-sized primary navigation targets", () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <MobileNav />
      </MemoryRouter>,
    );

    expect(screen.getByRole("navigation", { name: "移动主导航" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "首页" })).toHaveClass("min-h-11", "min-w-11");
    expect(screen.getByRole("button", { name: "更多菜单" })).toHaveClass("min-h-11", "min-w-11");
  });

  it("groups the expanded module menu into spacious touch targets", () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <MobileNav />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "更多菜单" }));
    expect(screen.getByRole("dialog", { name: "更多功能菜单" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "食材管理" })).toHaveClass("min-h-16");
  });
});
