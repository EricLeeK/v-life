import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { format } from "date-fns";
import Index from "./Index";

const state = vi.hoisted(() => ({ hidden: [] as string[], historyError: false }));

vi.mock("@/components/AppLayout", () => ({ AppLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock("@/contexts/LanguageContext", () => ({ useLang: () => ({ lang: "zh", t: (zh: string) => zh }) }));
vi.mock("@/contexts/DemoModeContext", () => ({ useDemoMode: () => ({ isDemo: false }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: (table: string) => {
  let columns = "*";
  const query = { select: (value: string) => { columns = value; return query; }, order: () => query, gte: () => query, gt: () => query, lt: () => query,
    lte: () => query, eq: () => query, not: () => query, limit: () => query,
    then: (resolve: (v: unknown) => unknown) => Promise.resolve({
      data: table === "settings" ? [{ id: "settings", hidden_features: state.hidden }] : [],
      error: state.historyError && table === "calorie_records" && columns === "date, calories, meal_type" ? new Error("offline") : null,
    }).then(resolve) };
  return query;
} } }));

const clients: QueryClient[] = [];
beforeEach(() => { state.hidden = []; state.historyError = false; });
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); });
function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 180_000 } } });
  clients.push(client);
  render(<QueryClientProvider client={client}><MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><Index /></MemoryRouter></QueryClientProvider>);
  const fetchedKeys = () => client.getQueryCache().getAll().filter(q => q.state.dataUpdatedAt > 0).map(q => q.queryKey);
  return { client, fetchedKeys };
}

describe("dashboard request budget", () => {
  it("does not fetch hidden history or duplicate financial/todo datasets", async () => {
    const { client, fetchedKeys } = mount();
    await waitFor(() => expect(client.isFetching()).toBe(0));
    expect(fetchedKeys()).toHaveLength(6);
    expect(fetchedKeys()).not.toContainEqual(["todos", "pending"]);
    expect(fetchedKeys().some(k => k[0] === "finance" && k[1] === "summary")).toBe(false);
    expect(fetchedKeys().some(k => k[0] === "calories" && k[1] === undefined)).toBe(false);
    expect(fetchedKeys().some(k => k[0] === "schedule" && k[1] === undefined)).toBe(false);
    expect(fetchedKeys().some(k => k[0] === "thoughts")).toBe(false);
    expect(screen.queryByText("本周目标完成")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "展开状态洞察" }));
    await waitFor(() => expect(fetchedKeys().some(k => k[0] === "calories" && k[1] === "range")).toBe(true));
    expect(await screen.findByText("本周暂无记录")).toBeVisible();
    expect(fetchedKeys()).toHaveLength(10);
    fireEvent.click(screen.getByRole("button", { name: "收起洞察" }));
    expect(screen.queryByText("本周暂无记录")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /展开全部模块/ }));
    await waitFor(() => expect(fetchedKeys().some(k => k[0] === "thoughts")).toBe(true));
    expect(fetchedKeys()).toHaveLength(15);
  });

  it("loads replacement metrics when primary modules are hidden", async () => {
    state.hidden = ["schedule", "todos", "finance", "calories"];
    const { client, fetchedKeys } = mount();
    await waitFor(() => expect(client.isFetching()).toBe(0));
    expect(fetchedKeys().some(k => k[0] === "goals")).toBe(true);
    expect(fetchedKeys().some(k => k[0] === "projects")).toBe(true);
    const metrics = screen.getByRole("region", { name: "今日关键数据" });
    expect(within(metrics).getByText("本周目标")).toBeInTheDocument();
    expect(within(metrics).getByText("活跃项目")).toBeInTheDocument();
  });

  it("offers retry instead of reporting an empty history on a failed lazy query", async () => {
    state.historyError = true;
    const { client } = mount();
    await waitFor(() => expect(client.isFetching()).toBe(0));
    fireEvent.click(screen.getByRole("button", { name: "展开状态洞察" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("洞察数据未能加载");
    expect(screen.queryByText("本周暂无记录")).not.toBeInTheDocument();
    state.historyError = false;
    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    expect(await screen.findByText("本周暂无记录")).toBeVisible();
  });

  it("shares finance data while keeping adjacent-month rows out of the monthly total", async () => {
    const { client } = mount();
    await waitFor(() => expect(client.isFetching()).toBe(0));
    const now = new Date();
    const date = format(now, "yyyy-MM-dd");
    const nextMonth = format(new Date(now.getFullYear(), now.getMonth() + 1, 1), "yyyy-MM-dd");
    client.setQueryData(["finance", "month", now.getFullYear(), now.getMonth() + 1], [
      { date, amount_cny: 80 }, { date: nextMonth, amount_cny: 999 },
    ]);
    await waitFor(() => expect(screen.getByText("本月 ¥80")).toBeInTheDocument());
    expect(screen.queryByText("本月 ¥1079")).not.toBeInTheDocument();
  });
});
