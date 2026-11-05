import { describe, expect, it, vi } from "vitest";
import { loadUsdCnyRate } from "./subscriptionExchangeRate";

function memoryStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
  };
}

const jsonResponse = (body: unknown, ok = true) => ({ ok, json: async () => body }) as Response;

describe("loadUsdCnyRate", () => {
  it("loads and caches a validated USD/CNY reference rate", async () => {
    const storage = memoryStorage();
    const fetcher = vi.fn().mockResolvedValue(jsonResponse({ date: "2026-11-04", base: "USD", quote: "CNY", rate: 7.12 }));

    const result = await loadUsdCnyRate({ fetcher, storage, now: Date.parse("2026-11-05T02:00:00Z") });

    expect(fetcher).toHaveBeenCalledWith("https://api.frankfurter.dev/v2/rate/usd/cny", expect.any(Object));
    expect(result).toMatchObject({ rate: 7.12, date: "2026-11-04", source: "live" });
    expect(storage.getItem("vlife.subscription.usd-cny-rate")).toContain('"rate":7.12');
  });

  it("uses a same-day cached rate without making another request", async () => {
    const storage = memoryStorage();
    const fetcher = vi.fn();
    await loadUsdCnyRate({
      storage,
      fetcher: vi.fn().mockResolvedValue(jsonResponse({ date: "2026-11-04", base: "USD", quote: "CNY", rate: 7.12 })),
      now: Date.parse("2026-11-05T02:00:00Z"),
    });

    const result = await loadUsdCnyRate({ storage, fetcher, now: Date.parse("2026-11-05T18:00:00Z") });

    expect(result).toMatchObject({ rate: 7.12, date: "2026-11-04", source: "cache" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("uses a dated stale cache and marks it when the reference service is unavailable", async () => {
    const storage = memoryStorage();
    await loadUsdCnyRate({
      storage,
      fetcher: vi.fn().mockResolvedValue(jsonResponse({ date: "2026-11-04", base: "USD", quote: "CNY", rate: 7.12 })),
      now: Date.parse("2026-11-05T02:00:00Z"),
    });

    const result = await loadUsdCnyRate({
      storage,
      fetcher: vi.fn().mockRejectedValue(new Error("offline")),
      now: Date.parse("2026-11-07T18:00:00Z"),
    });

    expect(result).toMatchObject({ rate: 7.12, date: "2026-11-04", source: "stale-cache" });
  });

  it("returns an explicit unavailable result instead of inventing or hiding a rate", async () => {
    const result = await loadUsdCnyRate({ fetcher: vi.fn().mockRejectedValue(new Error("offline")), storage: memoryStorage() });

    expect(result).toEqual({ rate: null, date: null, source: "unavailable" });
  });

  it("times out a stalled reference request and returns the explicit unavailable state", async () => {
    const result = await loadUsdCnyRate({
      fetcher: vi.fn(() => new Promise<Response>(() => undefined)),
      storage: memoryStorage(),
      timeoutMs: 5,
    });

    expect(result).toEqual({ rate: null, date: null, source: "unavailable" });
  });

  it("propagates query cancellation to the in-flight request", async () => {
    const controller = new AbortController();
    const fetcher = vi.fn((_url: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    }));
    const request = loadUsdCnyRate({ fetcher, storage: memoryStorage(), signal: controller.signal });
    controller.abort();

    await expect(request).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("rejects malformed or unrelated currency responses", async () => {
    const result = await loadUsdCnyRate({
      fetcher: vi.fn().mockResolvedValue(jsonResponse({ date: "2026-11-04", base: "EUR", quote: "CNY", rate: 7.12 })),
      storage: memoryStorage(),
    });

    expect(result).toEqual({ rate: null, date: null, source: "unavailable" });
  });
});
