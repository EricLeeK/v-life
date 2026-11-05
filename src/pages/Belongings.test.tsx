import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import BelongingsPage from "./Belongings";

vi.mock("@/components/AppLayout", () => ({ AppLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock("@/contexts/LanguageContext", () => ({ useLang: () => ({ lang: "zh", t: (zh: string) => zh }) }));
vi.mock("@/components/belongings/SubscriptionPanel", () => ({ SubscriptionPanel: () => <div /> }));
vi.mock("@/components/concepts/CollectionFeedback", () => ({ CollectionFeedback: ({ children }: { children: React.ReactNode }) => <>{children}</> }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/hooks/useData", () => {
  const mutation = () => ({ mutateAsync: vi.fn(), isPending: false });
  const hooks = {
    useList: () => ({ data: [], isLoading: false, error: null, refetch: vi.fn() }),
    useCreate: mutation,
    useUpdate: mutation,
    useDelete: mutation,
  };
  return { belongingsDailyHooks: hooks, belongingsDurableHooks: hooks };
});

afterEach(cleanup);

describe("Belongings navigation", () => {
  it("gives all three tab indicators equal width and height", () => {
    render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><BelongingsPage /></MemoryRouter>);

    const tabList = screen.getByRole("tablist");
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(3);
    expect(tabList).toHaveClass("grid-cols-3");
    expect(tabList).toHaveClass("sm:w-[21rem]");
    expect(new Set(tabs.map(tab => tab.className)).size).toBe(1);
    for (const tab of tabs) expect(tab).toHaveClass("h-11", "w-full");
  });
});
