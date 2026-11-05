import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SubscriptionPanel } from "./SubscriptionPanel";

const api = vi.hoisted(() => ({ save: vi.fn(), remove: vi.fn(), pay: vi.fn(), retry: vi.fn(), error: null as Error | null, items: [] as unknown[], lang: "zh", rate: { data: { rate: 7.2, date: "2026-01-30", source: "live" }, isLoading: false, refetch: vi.fn() } }));
vi.mock("@/hooks/useSubscriptions", () => ({
  useSubscriptions: () => ({ data: api.items, isLoading: false, error: api.error, refetch: api.retry }),
  useSubscriptionPayments: () => ({ data: [], isLoading: false, error: null }),
  useSubscriptionMutations: () => ({ save: { mutateAsync: api.save }, remove: { mutateAsync: api.remove }, confirmPayment: { mutateAsync: api.pay } }),
}));
vi.mock("@/hooks/useLocalDate", () => ({ useLocalDate: () => "2026-01-31" }));
vi.mock("@/hooks/useSubscriptionExchangeRate", () => ({ useUsdCnyRate: () => api.rate }));
vi.mock("@/contexts/LanguageContext", () => ({ useLang: () => ({ lang: api.lang, t: (zh: string, en: string) => api.lang === "zh" ? zh : en }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const subscription = {
  id: "s1", name: "测试工具", url: "https://example.com", management_url: null, category: "AI 工具", plan: "Pro", account: null, notes: null,
  amount: 20, currency: "USD", billing_type: "fixed", billing_unit: "month", billing_interval: 1, status: "active", auto_renew: true,
  next_date: "2026-01-31", anchor_day: 31, reminder_days: 3,
};
beforeEach(() => { vi.clearAllMocks(); api.lang = "zh"; api.items = [subscription]; api.error = null; api.rate = { data: { rate: 7.2, date: "2026-01-30", source: "live" }, isLoading: false, refetch: vi.fn() }; api.save.mockResolvedValue({}); api.pay.mockResolvedValue({}); });
afterEach(cleanup);
const change = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

function pickDate(name: RegExp, iso: string) {
  const field = screen.getByRole("button", { name });
  const initial = (field.getAttribute("aria-label") ?? "").match(/(\d{4})年(\d{1,2})月/);
  let shown = initial ? `${initial[1]}-${initial[2].padStart(2, "0")}` : "2026-01";
  fireEvent.click(field);
  const dialog = screen.getByRole("dialog", { name });
  const target = iso.slice(0, 7);
  for (let step = 0; step < 36; step += 1) {
    if (shown === target) {
      fireEvent.click(dialog.querySelector<HTMLButtonElement>(`[data-current] button[data-date="${iso}"]`)!);
      fireEvent.click(within(dialog).getByRole("button", { name: /^(确定|Apply)$/ }));
      return;
    }
    fireEvent.click(within(dialog).getByRole("button", { name: shown < target ? "Next month" : "Previous month" }));
    const [year, month] = shown.split("-").map(Number);
    const next = new Date(Date.UTC(year, month - 1 + (shown < target ? 1 : -1), 1));
    shown = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  throw new Error(`Could not find ${iso}`);
}

function selectOption(label: string, value: string) {
  fireEvent.click(screen.getByRole("combobox", { name: label }));
  fireEvent.click(screen.getByRole("option", { name: value }));
}

describe("subscription workflows", () => {
  it("creates a subscription with a usable URL and separate original currency", async () => {
    render(<SubscriptionPanel />);
    fireEvent.click(screen.getByRole("button", { name: "添加订阅" }));
    change(/服务名称/, "云盘"); change("服务网址", "example.org"); change(/^价格/, "240");
    selectOption("币种", "CNY"); fireEvent.click(screen.getByRole("button", { name: "年付" })); pickDate(/下次扣款.*到期日/, "2026-02-15");
    fireEvent.click(screen.getByRole("button", { name: "保存订阅" }));
    await waitFor(() => expect(api.save).toHaveBeenCalledWith(expect.objectContaining({ name: "云盘", url: "https://example.org/", amount: 240, currency: "CNY", billing_unit: "month", billing_interval: 12, next_date: "2026-02-15" })));
  });
  it("keeps a failed save open and lets the user retry", async () => {
    api.save.mockRejectedValueOnce(new Error("连接失败"));
    render(<SubscriptionPanel />);
    fireEvent.click(screen.getByRole("button", { name: "编辑 测试工具" }));
    fireEvent.click(screen.getByRole("button", { name: "保存订阅" }));
    await screen.findByText("连接失败");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "保存订阅" }));
    await waitFor(() => expect(api.save).toHaveBeenCalledTimes(2));
  });
  it("shows the next charge without a payment action", () => {
    render(<SubscriptionPanel />);
    expect(screen.getByText(/今天扣款/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /确认付款|已付/ })).not.toBeInTheDocument();
  });
  it("shows the effective renewal date after a missed auto-renewal", () => {
    api.items = [{ ...subscription, next_date: "2025-12-31" }];
    render(<SubscriptionPanel />);
    expect(screen.getByText("今天扣款")).toBeInTheDocument();
    expect(screen.getByText("01-31")).toBeInTheDocument();
    expect(screen.queryByText(/过期/)).not.toBeInTheDocument();
  });
  it("sorts subscriptions by effective dates after missed auto-renewals roll forward", () => {
    api.items = [
      { ...subscription, id: "old", name: "Old yearly", next_date: "2025-03-01", billing_interval: 12, anchor_day: 1 },
      { ...subscription, id: "soon", name: "February renewal", next_date: "2026-02-01" },
    ];
    render(<SubscriptionPanel />);
    expect(Array.from(document.querySelectorAll(".row-title")).map(node => node.textContent))
      .toEqual(["February renewal", "Old yearly"]);
  });
  it("combines CNY and USD summary amounts in the Chinese display currency", () => {
    api.items = [subscription, { ...subscription, id: "s2", name: "本地服务", amount: 100, currency: "CNY" }];
    render(<SubscriptionPanel />);
    expect(screen.getByText(/CNY\s*244\.00/)).toBeInTheDocument();
    expect(screen.getByText(/Frankfurter.*1.*USD.*7\.2/i)).toBeInTheDocument();
  });
  it("combines CNY and USD summary amounts in the English display currency", () => {
    api.lang = "en";
    api.items = [subscription, { ...subscription, id: "s2", name: "Local service", amount: 100, currency: "CNY" }];
    render(<SubscriptionPanel />);
    expect(screen.getByText(/USD\s*33\.89/)).toBeInTheDocument();
    expect(screen.getByText(/Estimated from Frankfurter.*1.*USD.*7\.2/i)).toBeInTheDocument();
  });
  it("shows original currencies and a visible status when no exchange rate is available", () => {
    api.items = [subscription, { ...subscription, id: "s2", name: "本地服务", amount: 100, currency: "CNY" }];
    api.rate = { data: { rate: null, date: null, source: "unavailable" }, isLoading: false, refetch: vi.fn() };
    render(<SubscriptionPanel />);
    expect(screen.getByText(/汇率暂不可用/)).toBeInTheDocument();
    expect(screen.getAllByText(/CNY\s*100\.00/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/USD\s*20\.00/).length).toBeGreaterThanOrEqual(2);
  });
  it("searches by URL and supports custom categories", () => {
    render(<SubscriptionPanel />);
    change("搜索订阅", "example.com");
    expect(screen.getByText("测试工具")).toBeInTheDocument();
    change("搜索订阅", "absent.example");
    expect(screen.getByText("没有符合条件的订阅")).toBeInTheDocument();
  });
  it("shows a recoverable load error instead of an empty subscription list", () => {
    api.error = new Error("无法连接");
    render(<SubscriptionPanel />);
    expect(screen.getByRole("alert")).toHaveTextContent("加载订阅失败");
    fireEvent.click(screen.getByRole("button", { name: "重试" }));
    expect(api.retry).toHaveBeenCalledOnce();
  });
  it("uses the branded category select arrow when filtering categories", () => {
    api.items = [subscription, { ...subscription, id: "s2", category: "影音" }];
    render(<SubscriptionPanel />);
    const categorySelect = screen.getByRole("combobox", { name: "筛选分类" });
    expect(categorySelect).toHaveClass("paper-select-trigger");
    expect(categorySelect.querySelector(".paper-select-chevron")).toBeInTheDocument();
  });
  it("keeps long amounts inside an aligned amount column and reserves a fixed cycle column", () => {
    api.items = [{ ...subscription, amount: 999999999999.99 }, { ...subscription, id: "s2", name: "Short amount", amount: 1 }];
    render(<SubscriptionPanel />);
    const rows = screen.getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    const longRow = screen.getByRole("button", { name: "编辑 测试工具" }).closest("li");
    expect(longRow).toHaveClass("lg:grid-cols-[minmax(0,1fr)_minmax(8rem,1fr)_4.5rem_minmax(8rem,1fr)_10rem]");
    const longAmounts = within(longRow!).getAllByText(/999,999,999,999\.99/);
    expect(longAmounts).toHaveLength(2);
    for (const amount of longAmounts) expect(amount).toHaveClass("[overflow-wrap:anywhere]", "text-right");
    expect(within(longRow!).getAllByText("/ 月")).toHaveLength(2);
  });
  it("shows a real zero forecast when no automatic charge falls in the next thirty days", () => {
    api.items = [{ ...subscription, auto_renew: false, next_date: "2026-12-31" }];
    render(<SubscriptionPanel />);
    expect(screen.getByText(/CNY\s*0\.00/)).toBeInTheDocument();
    expect(screen.queryByText("—")).not.toBeInTheDocument();
  });
  it("wraps large summary amounts and gives the third metric its own mobile row", () => {
    api.items = [{ ...subscription, amount: 999999999999.99, currency: "CNY" }];
    render(<SubscriptionPanel />);
    const summary = screen.getByRole("region", { name: "订阅服务" }).querySelector("dl");
    expect(summary).toHaveClass("grid-cols-2");
    expect(summary?.children[0]).toHaveClass("min-w-0");
    expect(summary?.children[2]).toHaveClass("col-span-2", "sm:col-span-1");
    expect(summary?.querySelector("dd span.block")).toHaveClass("min-w-0", "[overflow-wrap:anywhere]");
  });
  it("keeps the auto-renew reminder fixed at three days and saves that setting", async () => {
    api.items = [{ ...subscription, reminder_days: null }];
    render(<SubscriptionPanel />);
    fireEvent.click(screen.getByRole("button", { name: "编辑 测试工具" }));
    expect(screen.getByText("提前 3 天")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "提前 7 天" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "保存订阅" }));
    await waitFor(() => expect(api.save).toHaveBeenCalledWith(expect.objectContaining({ reminder_days: 3 })));
  });
});
