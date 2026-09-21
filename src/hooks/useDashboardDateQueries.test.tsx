import type { ReactNode } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCaloriesByRange, useCurrentWeekGoals, useExpiringPantry, useTodayCalorieBreakdown, useTodayCalorieSummary, useTodaySchedule } from "./useData";

type Row = Record<string, string | number | null>;
const db = vi.hoisted(() => ({ tables: {} as Record<string, Row[]>, selections: [] as string[] }));
vi.mock("@/contexts/DemoModeContext", () => ({ useDemoMode: () => ({ isDemo: false }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: (table: string) => {
    let rows = db.tables[table] ?? [];
    const query = {
      select: (columns: string) => { db.selections.push(columns); return query; },
      eq: (key: string, value: unknown) => { rows = rows.filter(row => row[key] === value); return query; },
      gte: (key: string, value: string) => { rows = rows.filter(row => String(row[key]) >= value); return query; },
      lt: (key: string, value: string) => { rows = rows.filter(row => String(row[key]) < value); return query; },
      lte: (key: string, value: string) => { rows = rows.filter(row => String(row[key]) <= value); return query; },
      not: (key: string, _operator: string, value: unknown) => { rows = rows.filter(row => row[key] !== value); return query; },
      order: () => query,
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(resolve),
    };
    return query;
  },
} }));

const clients: QueryClient[] = [];
function mount<T>(hook: () => T) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  clients.push(client);
  const result = renderHook(hook, { wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider> });
  return { ...result, client };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 8, 8, 6));
  db.selections = [];
  db.tables = {
    calorie_records: [
      { date: "2026-09-06", calories: 900, meal_type: "lunch" },
      { date: "2026-09-07", calories: 250, meal_type: "lunch" },
      { date: "2026-09-08", calories: 700, meal_type: "lunch" },
      { date: "2026-09-08", calories: 50, meal_type: "exercise" },
      { date: "2026-09-09", calories: 500, meal_type: "lunch" },
    ],
  };
});
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); vi.useRealTimers(); });

describe("dashboard local-date queries", () => {
  it("reads today's net calories at 06:00 local time, not the UTC day", async () => {
    const { result, client } = mount(() => ({ summary: useTodayCalorieSummary(), breakdown: useTodayCalorieBreakdown() }));
    await waitFor(() => expect(result.current.summary.data).toBe(650));
    expect(result.current.breakdown.data).toEqual({ lunch: 700, exercise: 50 });
    expect(client.getQueryData(["calories", "today_summary", "2026-09-08"])).toBe(650);
  });

  it("refreshes day-specific queries after waking on the next day despite fresh old cache", async () => {
    db.tables.schedule_events = [
      { id: "old", start_time: new Date(2026, 8, 8, 10).toISOString() },
      { id: "new", start_time: new Date(2026, 8, 9, 10).toISOString() },
    ];
    const { result, client } = mount(() => ({ calories: useTodayCalorieSummary(), schedule: useTodaySchedule() }));
    await waitFor(() => expect(result.current.calories.data).toBe(650));
    await waitFor(() => expect(result.current.schedule.data?.[0].id).toBe("old"));
    act(() => { vi.setSystemTime(new Date(2026, 8, 9, 0, 1)); window.dispatchEvent(new Event("focus")); });
    await waitFor(() => expect(result.current.calories.data).toBe(500));
    await waitFor(() => expect(result.current.schedule.data?.[0].id).toBe("new"));
    expect(client.getQueryData(["calories", "today_summary", "2026-09-09"])).toBe(500);
  });

  it("loads Monday's weekly goals just after local midnight on Monday", async () => {
    vi.setSystemTime(new Date(2026, 8, 7, 0, 30));
    db.tables.goals = [
      { id: "this-week", type: "week", period_start: "2026-09-07" },
      { id: "previous-week", type: "week", period_start: "2026-08-31" },
    ];
    const { result } = mount(() => useCurrentWeekGoals());
    await waitFor(() => expect(result.current.data).toEqual([db.tables.goals[0]]));
  });

  it("fetches only Monday through today for calorie insights", async () => {
    const { result } = mount(() => useCaloriesByRange("2026-09-07", "2026-09-08"));
    await waitFor(() => expect(result.current.data).toHaveLength(3));
    expect(result.current.data?.map(row => row.date)).toEqual(["2026-09-07", "2026-09-08", "2026-09-08"]);
    expect(db.selections).toEqual(["date, calories, meal_type"]);
  });

  it("includes the full third local calendar day in homepage expiry alerts", async () => {
    db.tables.pantry_items = [
      { id: "three-days", expiry_date: "2026-09-11" },
      { id: "four-days", expiry_date: "2026-09-12" },
      { id: "no-date", expiry_date: null },
    ];
    const { result } = mount(() => useExpiringPantry());
    await waitFor(() => expect(result.current.data).toEqual([db.tables.pantry_items[0]]));
  });
});
