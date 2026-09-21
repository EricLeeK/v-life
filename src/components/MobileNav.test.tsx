import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
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

vi.mock("@/hooks/useData", () => ({
  useSettings: () => ({ data: { hidden_features: [], app_focus_mode: "full" } }),
}));

describe("MobileNav", () => {
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
