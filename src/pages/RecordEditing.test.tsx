import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import BelongingsPage from "./Belongings";
import FinancePage from "./Finance";

const api = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn(), toast: vi.fn(), pending: false, currency: "JPY" }));
vi.mock("@/components/AppLayout", () => ({ AppLayout: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("recharts", () => ({ PieChart: () => null, Pie: () => null, Cell: () => null, ResponsiveContainer: () => null, Tooltip: () => null }));
vi.mock("@/contexts/LanguageContext", () => ({ useLang: () => ({ lang: "zh", t: (zh: string) => zh }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: api.toast }) }));
vi.mock("@/hooks/useData", () => {
  const mutations = {
    useCreate: () => ({ mutateAsync: api.create, isPending: api.pending }),
    useUpdate: () => ({ mutateAsync: api.update, isPending: api.pending }),
    useDelete: () => ({ mutateAsync: vi.fn(), isPending: false }),
  };
  return {
    belongingsDailyHooks: { ...mutations, useList: () => ({ data: [{ id: "old", name: "旧用品", category: "清洁" }] }) },
    belongingsDurableHooks: { ...mutations, useList: () => ({ data: [] }) },
    financeHooks: mutations,
    useFinanceByMonth: () => ({ data: [{ id: "expense", name: "午餐", category: "餐饮", currency: api.currency, amount: 1000, amount_cny: 50, exchange_rate: 0.05, date: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-15` }] }),
    useSettings: () => ({ data: { exchange_rate_jpy_to_cny: 0.06 } }),
  };
});

beforeEach(() => { vi.clearAllMocks(); api.pending = false; api.currency = "JPY"; api.create.mockResolvedValue({}); api.update.mockResolvedValue({}); });
afterEach(cleanup);
const show = (page: ReactNode) => render(<MemoryRouter>{page}</MemoryRouter>);
const change = (label: string | RegExp, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });

describe("record editing integrity", () => {
  it("creates a separate belonging after cancelling an edit", async () => {
    show(<BelongingsPage />);
    fireEvent.click(screen.getByRole("button", { name: "编辑日用品" }));
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "添加" }));
    change(/名称/, "新用品"); change(/分类/, "清洁");
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(api.create).toHaveBeenCalledWith(expect.objectContaining({ name: "新用品" })));
    expect(api.update).not.toHaveBeenCalled();
  });

  it("preserves the historic finance conversion when only a note changes", async () => {
    show(<FinancePage />);
    fireEvent.click(screen.getByRole("button", { name: /\d{2}\/\d{2} - / }));
    fireEvent.click(screen.getByRole("button", { name: "编辑记录" }));
    change("备注", "补充备注");
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    await waitFor(() => expect(api.update).toHaveBeenCalledWith(expect.objectContaining({ amount_cny: 50, exchange_rate: 0.05 })));
  });

  it("rejects negative expense amounts before persistence", () => {
    show(<FinancePage />);
    fireEvent.click(screen.getByRole("button", { name: /\d{2}\/\d{2} - / }));
    fireEvent.click(screen.getByRole("button", { name: "编辑记录" }));
    change(/金额/, "-20");
    fireEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(api.update).not.toHaveBeenCalled();
    expect(api.toast).toHaveBeenCalledWith(expect.objectContaining({ variant: "destructive" }));
  });
});

it("displays and edits a subscription expense in its original USD currency", async () => {
  api.currency = "USD";
  show(<FinancePage />);
  fireEvent.click(screen.getByRole("button", { name: /\d{2}\/\d{2} - / }));
  expect(screen.getByText(/1,?000(?:\.00)? USD/)).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "编辑记录" }));
  expect(screen.getByLabelText("货币")).toHaveTextContent("USD");
  change("备注", "美元订阅");
  fireEvent.click(screen.getByRole("button", { name: "保存" }));
  await waitFor(() => expect(api.update).toHaveBeenCalledWith(expect.objectContaining({currency:"USD", amount_cny:50, exchange_rate:0.05})));
});
