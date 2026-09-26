import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SubscriptionPanel } from "./SubscriptionPanel";

const api = vi.hoisted(() => ({ save: vi.fn(), remove: vi.fn(), pay: vi.fn(), retry: vi.fn(), error: null as Error | null, items: [] as unknown[] }));
vi.mock("@/hooks/useSubscriptions", () => ({
  useSubscriptions: () => ({ data: api.items, isLoading: false, error: api.error, refetch: api.retry }),
  useSubscriptionPayments: () => ({ data: [], isLoading: false, error: null }),
  useSubscriptionMutations: () => ({ save: { mutateAsync: api.save }, remove: { mutateAsync: api.remove }, confirmPayment: { mutateAsync: api.pay } }),
}));
vi.mock("@/hooks/useLocalDate", () => ({ useLocalDate: () => "2026-01-31" }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const subscription = {
  id: "s1", name: "测试工具", url: "https://example.com", management_url: null, category: "AI 工具", plan: "Pro", account: null, notes: null,
  amount: 20, currency: "USD", billing_type: "fixed", billing_unit: "month", billing_interval: 1, status: "active", auto_renew: true,
  next_date: "2026-01-31", anchor_day: 31, reminder_days: 3,
};
beforeEach(() => { vi.clearAllMocks(); api.items = [subscription]; api.error = null; api.save.mockResolvedValue({}); api.pay.mockResolvedValue({}); });
afterEach(cleanup);
const change = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("subscription workflows", () => {
  it("creates a subscription with a usable URL and separate original currency", async () => {
    render(<SubscriptionPanel />);
    fireEvent.click(screen.getByRole("button", { name: "添加订阅" }));
    change(/服务名称/, "云盘"); change("服务网址", "example.org"); change(/^价格/, "240");
    change("币种", "CNY"); change("付费周期", "year"); change(/下次扣款.*到期日/, "2026-12-15");
    fireEvent.click(screen.getByRole("button", { name: "保存订阅" }));
    await waitFor(() => expect(api.save).toHaveBeenCalledWith(expect.objectContaining({ name: "云盘", url: "https://example.org/", amount: 240, currency: "CNY", billing_unit: "month", billing_interval: 12, next_date: "2026-12-15" })));
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
  it("confirms a monthly payment using the anchored next date and explicit USD rate", async () => {
    render(<SubscriptionPanel />);
    fireEvent.click(screen.getByRole("button", { name: "确认付款 测试工具" }));
    expect(screen.getByLabelText("下次扣款／到期日")).toHaveValue("2026-02-28");
    fireEvent.click(screen.getByRole("checkbox", { name: "同时记一笔" }));
    change("人民币汇率", "7.2");
    fireEvent.click(screen.getByRole("button", { name: "确认已付款" }));
    await waitFor(() => expect(api.pay).toHaveBeenCalledWith(expect.objectContaining({ subscription_id: "s1", due_date: "2026-01-31", paid_on: "2026-01-31", next_date: "2026-02-28", record_expense: true, exchange_rate: 7.2 })));
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
});
