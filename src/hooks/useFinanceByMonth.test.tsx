import type { ReactNode } from "react";
import { cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useFinanceByMonth } from "./useData";

const fixture = vi.hoisted(() => ({ isDemo: false, rows: [] as { date: string }[] }));
vi.mock("@/contexts/DemoModeContext", () => ({
  useDemoMode: () => ({ isDemo: fixture.isDemo, demoData: { finance_records: fixture.rows } }),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: () => {
    let rows = fixture.rows;
    const query = {
      select: () => query,
      gte: (_key: string, value: string) => { rows = rows.filter(row => row.date >= value); return query; },
      lt: (_key: string, value: string) => { rows = rows.filter(row => row.date < value); return query; },
      order: () => query,
      then: (resolve: (value: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(resolve),
    };
    return query;
  },
} }));

const clients: QueryClient[] = [];
afterEach(() => { cleanup(); clients.splice(0).forEach(client => client.clear()); });

describe.each([false, true])("calendar-month finance query (demo=%s)", isDemo => {
  it.each([
    [2026, 10, "2026-09-30", "2026-10-01", "2026-10-31", "2026-11-01"],
    [2026, 12, "2026-11-30", "2026-12-01", "2026-12-31", "2027-01-01"],
    [2024, 2, "2024-01-31", "2024-02-01", "2024-02-29", "2024-03-01"],
  ] as const)("includes only actual dates in %i-%i", async (year, month, before, first, last, after) => {
    fixture.isDemo = isDemo;
    fixture.rows = [before, first, last, after].map(date => ({ date }));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    clients.push(client);
    const { result } = renderHook(() => useFinanceByMonth(year, month), {
      wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
    });
    await waitFor(() => expect(result.current.data?.map(row => row.date)).toEqual([first, last]));
  });
});
