import type { ReactNode } from "react";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBuyFromShop, useGachaPity, usePullGacha, useRecalculatePoints, useUserPoints } from "./useData";

const api = vi.hoisted(() => ({ from: vi.fn(), getUser: vi.fn() }));
vi.mock("@/contexts/DemoModeContext", () => ({ useDemoMode: () => ({ isDemo: false }) }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: api.from, auth: { getUser: api.getUser } } }));

const userId = "signed-in-user";
const clients: QueryClient[] = [];
type Row = Record<string, unknown>;
let rows: Record<string, Row[]>;

beforeEach(() => {
  api.getUser.mockReset().mockResolvedValue({ data: { user: { id: userId } }, error: null });
  rows = {
    settings: [{ day_start_hour: 0 }],
    user_points: [],
    gacha_pity: [],
    user_inventory: [],
    shop_items: [{ id: "item", price: 50, rarity: "common", is_active: true }],
  };
  api.from.mockReset().mockImplementation((table: string) => {
    let operation = "read";
    let payload: Row = {};
    let single = false;
    const filters: Array<[string, unknown]> = [];
    const execute = async () => {
      let selected = rows[table].filter(row => filters.every(([key, value]) => row[key] === value));
      if (operation === "insert") {
        // These tables require the authenticated owner, with no database default.
        if (payload.user_id !== userId) return { data: null, error: new Error("user_id is required") };
        const row = { id: `${table}-${rows[table].length}`, ...payload };
        rows[table].push(row);
        selected = [row];
      } else if (operation === "update") {
        selected.forEach(row => Object.assign(row, payload));
      }
      return { data: single ? selected[0] ?? null : selected, error: null };
    };
    const builder = {
      select: () => builder,
      limit: () => builder,
      eq: (key: string, value: unknown) => { filters.push([key, value]); return builder; },
      insert: (value: Row) => { operation = "insert"; payload = value; return builder; },
      update: (value: Row) => { operation = "update"; payload = value; return builder; },
      single: () => { single = true; return execute(); },
      maybeSingle: () => { single = true; return execute(); },
      then: (resolve, reject) => execute().then(resolve, reject),
    };
    return builder;
  });
});

afterEach(() => {
  cleanup();
  clients.splice(0).forEach(client => client.clear());
});

function mount<T>(hook: () => T) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  clients.push(client);
  return renderHook(hook, {
    wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>,
  });
}

describe("points and shop ownership", () => {
  it("initializes points for the current user", async () => {
    const { result } = mount(useUserPoints);
    await waitFor(() => expect(result.current.isSuccess || result.current.isError).toBe(true));
    expect(result.current.error).toBeNull();
    expect(rows.user_points).toEqual([expect.objectContaining({ user_id: userId, total_points: 0 })]);
  });

  it("initializes points during daily settlement for the current user", async () => {
    const { result } = mount(useRecalculatePoints);
    await act(async () => { await result.current.mutateAsync(); });
    expect(rows.user_points).toEqual([expect.objectContaining({ user_id: userId, last_active_date: expect.any(String) })]);
  });

  it("initializes gacha pity for the current user", async () => {
    const { result } = mount(useGachaPity);
    await waitFor(() => expect(result.current.isSuccess || result.current.isError).toBe(true));
    expect(result.current.error).toBeNull();
    expect(rows.gacha_pity).toEqual([expect.objectContaining({ user_id: userId, total_pulls: 0 })]);
  });

  it("saves a gacha reward and first pity record under the same owner", async () => {
    rows.user_points = [{ id: "points", user_id: userId, total_points: 200 }];
    const { result } = mount(usePullGacha);
    await act(async () => { await result.current.mutateAsync(1); });
    expect(rows.user_inventory).toEqual([expect.objectContaining({ user_id: userId, source: "gacha_pull" })]);
    expect(rows.gacha_pity).toEqual([expect.objectContaining({ user_id: userId, total_pulls: 1 })]);
    expect(rows.user_points[0].total_points).toBe(100);
  });

  it("saves a purchased item and charges the same user", async () => {
    rows.user_points = [{ id: "points", user_id: userId, total_points: 200 }];
    const { result } = mount(useBuyFromShop);
    await act(async () => { await result.current.mutateAsync("item"); });
    expect(rows.user_inventory).toEqual([expect.objectContaining({ user_id: userId, source: "shop_purchase" })]);
    expect(rows.user_points[0].total_points).toBe(150);
  });

  it.each(["points", "pity"])("rejects %s initialization when signed out", async kind => {
    api.getUser.mockResolvedValue({ data: { user: null }, error: null });
    const { result } = mount(kind === "points" ? useUserPoints : useGachaPity);
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error.message).toBe("Not authenticated");
    expect(api.from).not.toHaveBeenCalled();
  });

  it.each(["settle", "gacha", "buy"])("rejects %s before database access when signed out", async operation => {
    api.getUser.mockResolvedValue({ data: { user: null }, error: null });
    const { result } = mount(() => ({ settle: useRecalculatePoints(), gacha: usePullGacha(), buy: useBuyFromShop() }));
    await act(async () => {
      const action = operation === "settle" ? result.current.settle.mutateAsync()
        : operation === "gacha" ? result.current.gacha.mutateAsync(1) : result.current.buy.mutateAsync("item");
      await expect(action).rejects.toThrow("Not authenticated");
    });
    expect(api.from).not.toHaveBeenCalled();
  });
});
