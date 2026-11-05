const CACHE_KEY = "vlife.subscription.usd-cny-rate";
const DAY_MS = 24 * 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 8_000;
const RATE_URL = "https://api.frankfurter.dev/v2/rate/usd/cny";

type StorageLike = Pick<Storage, "getItem" | "setItem">;
type RateSource = "live" | "cache" | "stale-cache" | "unavailable";

export interface UsdCnyRate {
  rate: number | null;
  date: string | null;
  source: RateSource;
}

interface CachedRate {
  rate: number;
  date: string;
  fetchedAt: number;
}

function validDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validRate(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function browserStorage(): StorageLike | undefined {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

function readCache(storage: StorageLike | undefined): CachedRate | null {
  try {
    const raw = storage?.getItem(CACHE_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<CachedRate>;
    return validRate(value.rate) && validDate(value.date) && Number.isFinite(value.fetchedAt)
      ? { rate: value.rate, date: value.date, fetchedAt: value.fetchedAt! }
      : null;
  } catch {
    return null;
  }
}

function result(cache: CachedRate, source: Exclude<RateSource, "unavailable">): UsdCnyRate {
  return { rate: cache.rate, date: cache.date, source };
}

export async function loadUsdCnyRate({
  fetcher = fetch,
  storage = browserStorage(),
  now = Date.now(),
  signal,
  timeoutMs = REQUEST_TIMEOUT_MS,
}: {
  fetcher?: typeof fetch;
  storage?: StorageLike;
  now?: number;
  signal?: AbortSignal;
  timeoutMs?: number;
} = {}): Promise<UsdCnyRate> {
  const cached = readCache(storage);
  if (cached && now >= cached.fetchedAt && now - cached.fetchedAt < DAY_MS) return result(cached, "cache");

  try {
    if (signal?.aborted) throw signal.reason ?? new Error("Exchange rate request was cancelled");
    const controller = new AbortController();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let rejectCancelled: (reason?: unknown) => void = () => undefined;
    const cancelled = new Promise<never>((_resolve, reject) => { rejectCancelled = reject; });
    const onAbort = () => {
      controller.abort(signal?.reason);
      rejectCancelled(signal?.reason ?? new Error("Exchange rate request was cancelled"));
    };
    signal?.addEventListener("abort", onAbort, { once: true });
    const timedOut = new Promise<never>((_resolve, reject) => {
      timeout = setTimeout(() => {
        controller.abort();
        reject(new Error("Exchange rate request timed out"));
      }, timeoutMs);
    });
    let response: Response;
    try {
      response = await Promise.race([
        fetcher(RATE_URL, { headers: { Accept: "application/json" }, signal: controller.signal }),
        timedOut,
        ...(signal ? [cancelled] : []),
      ]);
    } finally {
      if (timeout !== undefined) clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
    }
    if (!response.ok) throw new Error("Exchange rate service returned an error");
    const data = await response.json() as { base?: unknown; quote?: unknown; date?: unknown; rate?: unknown };
    if (data.base !== "USD" || data.quote !== "CNY" || !validDate(data.date) || !validRate(data.rate)) {
      throw new Error("Exchange rate response did not contain USD/CNY data");
    }
    const fresh: CachedRate = { rate: data.rate, date: data.date, fetchedAt: now };
    try { storage?.setItem(CACHE_KEY, JSON.stringify(fresh)); } catch { /* A valid live rate is still usable when browser storage is unavailable. */ }
    return result(fresh, "live");
  } catch {
    if (signal?.aborted) throw signal.reason ?? new Error("Exchange rate request was cancelled");
    return cached ? result(cached, "stale-cache") : { rate: null, date: null, source: "unavailable" };
  }
}
