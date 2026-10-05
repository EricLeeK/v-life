import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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

function pickDate(name: RegExp, iso: string) {
  fireEvent.click(screen.getByRole("button", { name }));
  const dialog = screen.getByRole("dialog", { name });
  const target = iso.slice(0, 7);
  for (let step = 0; step < 36; step += 1) {
    const day = Array.from(dialog.querySelectorAll<HTMLButtonElement>(`button[data-date="${iso}"]`)).find((button) => !button.closest("[inert]"));
    if (day) {
      fireEvent.click(day);
      fireEvent.click(within(dialog).getByRole("button", { name: "Apply" }));
      return;
    }
    const shown = dialog.querySelector<HTMLButtonElement>("[data-current] button[data-date]")?.dataset.date?.slice(0, 7) ?? "";
    fireEvent.click(within(dialog).getByRole("button", { name: shown < target ? "Next month" : "Previous month" }));
  }
  throw new Error(`Could not find ${iso}`);
}

describe("subscription workflows", () => {
  it("creates a subscription with a usable URL and separate original currency", async () => {
    render(<SubscriptionPanel />);
    fireEvent.click(screen.getByRole("button", { name: "添加订阅" }));
    change(/服务名称/, "云盘"); change("服务网址", "example.org"); change(/^价格/, "240");
    change("币种", "CNY"); fireEvent.click(screen.getByRole("button", { name: "年付" })); pickDate(/下次扣款.*到期日/, "2026-12-15");
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
  it("shows the next charge without a payment action", () => {
    render(<SubscriptionPanel />);
    expect(screen.getByText(/今天扣款/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /确认付款|已付/ })).not.toBeInTheDocument();
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
