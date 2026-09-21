import type { ReactNode } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import PantryPage from "./Pantry";

const state = vi.hoisted(() => ({
  items: [] as Array<{ id: string; name: string; category: string; expiry_date: string | null }>,
}));

vi.mock("@/components/AppLayout", () => ({ AppLayout: ({ children }: { children: ReactNode }) => children }));
vi.mock("@/contexts/LanguageContext", () => ({ useLang: () => ({ lang: "en", t: (_zh: string, en: string) => en }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/hooks/useLocalDate", () => ({ useLocalDate: () => "2026-09-08" }));
vi.mock("@/hooks/useData", () => ({
  pantryHooks: {
    useList: () => ({ data: state.items, isLoading: false }),
    useCreate: () => ({}),
    useUpdate: () => ({}),
    useDelete: () => ({}),
  },
}));

function addItem(name: string, expiry_date: string | null, category = "新鲜食材") {
  state.items.push({ id: name, name, expiry_date, category });
}

function itemRow(name: string) {
  return screen.getByText(name).parentElement!;
}

describe("pantry expiry and categories", () => {
  beforeEach(() => {
    state.items = [];
  });
  afterEach(() => {
    cleanup();
  });

  it("marks yesterday as expired at 06:00 local time and includes it in the expired filter", () => {
    addItem("Yesterday milk", "2026-09-07");
    render(<PantryPage />);
    expect(within(itemRow("Yesterday milk")).getByText("Expired")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Expired" }));
    expect(screen.getByText("Yesterday milk")).toBeInTheDocument();
  });

  it("uses calendar days for today and the inclusive three-day warning boundary", () => {
    addItem("Today eggs", "2026-09-08");
    addItem("Three-day tofu", "2026-09-11");
    addItem("Four-day vegetables", "2026-09-12");
    addItem("Undated rice", null);
    render(<PantryPage />);
    expect(within(itemRow("Today eggs")).getByText("Expiring Soon")).toBeInTheDocument();
    expect(within(itemRow("Three-day tofu")).getByText("Expiring Soon")).toBeInTheDocument();
    expect(within(itemRow("Four-day vegetables")).getByText("OK")).toBeInTheDocument();
    expect(within(itemRow("Undated rice")).getByText("OK")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Expiring Soon" }));
    expect(screen.queryByText("Four-day vegetables")).not.toBeInTheDocument();
  });

  it("keeps AI-created and custom categories visible and searchable", () => {
    addItem("Other food", null, "其他");
    addItem("Custom food", null, "自制酱菜");
    addItem("Unusual category food", null, "__proto__");
    render(<PantryPage />);
    expect(screen.getByText("Other food")).toBeInTheDocument();
    expect(screen.getByText("Custom food")).toBeInTheDocument();
    expect(screen.getByText("Unusual category food")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "自制酱菜" })).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText("Search pantry..."), { target: { value: "Custom" } });
    expect(screen.getByText("Custom food")).toBeInTheDocument();
    expect(screen.queryByText("Other food")).not.toBeInTheDocument();
  });
});
