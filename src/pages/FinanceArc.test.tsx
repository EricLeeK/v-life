import type { ReactNode } from "react";
import { act, fireEvent, render, screen, within, waitFor, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import FinancePage from "./Finance";

const fixture = vi.hoisted(() => {
  const today = new Date();
  const prefix = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  return {
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    toast: vi.fn(),
    records: [
      { id: "outside", name: "午餐", category: "餐饮", currency: "CNY", amount: 10, amount_cny: 10, exchange_rate: 1, date: `${prefix}-12` },
      { id: "start", name: "通勤", category: "交通", currency: "CNY", amount: 20, amount_cny: 20, exchange_rate: 1, date: `${prefix}-15` },
      { id: "end", name: "娱乐", category: "娱乐", currency: "CNY", amount: 30, amount_cny: 30, exchange_rate: 1, date: `${prefix}-20` },
    ],
  };
});

vi.mock("@/components/AppLayout", () => ({ AppLayout: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock("@/contexts/LanguageContext", () => ({ useLang: () => ({ lang: "zh", t: (zh: string) => zh }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: fixture.toast }) }));
vi.mock("@/hooks/useData", () => ({
  financeHooks: {
    useCreate: () => ({ mutateAsync: fixture.create, isPending: false }),
    useUpdate: () => ({ mutateAsync: fixture.update, isPending: false }),
    useDelete: () => ({ mutateAsync: fixture.remove, isPending: false }),
  },
  useFinanceByMonth: () => ({ data: fixture.records }),
  useSettings: () => ({ data: { monthly_budget: 5000, exchange_rate_jpy_to_cny: 0.048 } }),
}));

afterEach(cleanup);

function renderFinance() {
  return render(<MemoryRouter><FinancePage /></MemoryRouter>);
}

function isoDate(day: number) {
  return `${fixture.records[0].date.slice(0, 7)}-${String(day).padStart(2, "0")}`;
}

function monthDay(day: number) {
  return `${fixture.records[0].date.slice(5, 7)}/${String(day).padStart(2, "0")}`;
}

function expectTotal(value: string) {
  const overview = screen.getByRole("region", { name: "支出概览" });
  expect(overview).toHaveTextContent(value);
}

function clickCalendarDay(day: number) {
  const dialog = screen.getByRole("dialog", { name: "筛选日期范围" });
  const button = dialog.querySelector<HTMLButtonElement>(`button[data-date="${isoDate(day)}"]`);
  if (!button) throw new Error(`Calendar day ${isoDate(day)} is missing`);
  fireEvent.click(button);
}

function expandWeeklyGroups() {
  const groups = screen.getAllByRole("button").filter(button =>
    /\d{2}\/\d{2} - \d{2}\/\d{2}/.test(button.textContent ?? ""),
  );
  groups.forEach(group => fireEvent.click(group));
}

describe("Finance UIArc date range", () => {
  it("keeps native Finance surfaces outside Arc token scope while isolating original Arc controls", () => {
    renderFinance();

    const main = screen.getByRole("main");
    expect(main.closest(".arc-runtime")).toBeNull();
    expect(screen.getByRole("figure", { name: "分类支出构成" }).closest(".arc-runtime")).not.toBeNull();
    expect(screen.getByRole("figure", { name: "每日支出趋势" }).closest(".arc-runtime")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "记一笔" }));
    expect(screen.getByLabelText("名称 *")).toHaveClass("ledger-field");
  });

  it("filters totals, category chart, trend chart, and weekly records inclusively, then restores the month when cleared", () => {
    renderFinance();

    expectTotal("¥60.00");
    expect(screen.getByText("3 笔记录")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /筛选日期范围/ }));
    clickCalendarDay(15);
    clickCalendarDay(20);
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));

    expectTotal("¥50.00");
    expect(screen.getByText("2 笔记录")).toBeInTheDocument();

    const categories = within(screen.getByRole("figure", { name: "分类支出构成" })).getByRole("table");
    expect(categories).toHaveTextContent("交通");
    expect(categories).toHaveTextContent("娱乐");
    expect(categories).not.toHaveTextContent("餐饮");

    const trend = within(screen.getByRole("figure", { name: "每日支出趋势" })).getByRole("table");
    expect(trend).toHaveTextContent(monthDay(15));
    expect(trend).toHaveTextContent(monthDay(20));
    expect(trend).not.toHaveTextContent(monthDay(12));

    expandWeeklyGroups();
    const weeklyRecords = within(screen.getByRole("region", { name: "每周明细" }));
    expect(weeklyRecords.getByText("通勤")).toBeInTheDocument();
    expect(weeklyRecords.getByText("娱乐")).toBeInTheDocument();
    expect(weeklyRecords.queryByText("午餐")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "清除日期筛选" }));
    expectTotal("¥60.00");
    expect(screen.getByText("3 笔记录")).toBeInTheDocument();
    expect(screen.getByRole("figure", { name: "分类支出构成" })).toHaveTextContent("餐饮");
  });

  it("clears an applied date range when changing the selected month", () => {
    renderFinance();
    fireEvent.click(screen.getByRole("button", { name: /筛选日期范围/ }));
    clickCalendarDay(15);
    clickCalendarDay(20);
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(screen.getByRole("button", { name: /筛选日期范围: \d{4}/ })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "下个月" }));

    expect(screen.getByRole("button", { name: "筛选日期范围: 全部日期" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "清除日期筛选" })).not.toBeInTheDocument();
  });

  it("shows success only after the real create promise resolves and prevents a second create", async () => {
    let resolveCreate!: (record: (typeof fixture.records)[number]) => void;
    fixture.create.mockImplementationOnce(() => new Promise(resolve => { resolveCreate = resolve; }));
    renderFinance();

    fireEvent.click(screen.getByRole("button", { name: "记一笔" }));
    fireEvent.change(screen.getByLabelText("名称 *"), { target: { value: "咖啡" } });
    fireEvent.change(screen.getByLabelText("金额 *"), { target: { value: "25" } });
    const saveButton = screen.getByRole("button", { name: "保存" });
    const status = within(saveButton).getByRole("status");
    fireEvent.click(saveButton);

    expect(status).toHaveTextContent("保存中…");
    expect(saveButton).not.toBeDisabled();
    expect(saveButton).toHaveAttribute("aria-disabled", "true");
    expect(screen.queryByText("已保存")).not.toBeInTheDocument();
    expect(fixture.create).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveCreate({ id: "created", name: "咖啡", category: "餐饮", currency: "JPY", amount: 25, amount_cny: 1.2, exchange_rate: 0.048, date: isoDate(21) });
    });
    await waitFor(() => expect(status).toHaveTextContent("已保存"));
    expect(screen.getByRole("dialog", { name: "编辑 记录" })).toBeInTheDocument();
    expect(screen.getByLabelText("名称 *")).toBeDisabled();
    expect(screen.getByText("记录已保存，关闭后可继续记账")).toBeInTheDocument();
    expect(saveButton).toBeDisabled();

    fireEvent.click(saveButton);
    expect(fixture.create).toHaveBeenCalledTimes(1);
  });
});
