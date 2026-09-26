import { getErrorMessage } from "./errorMessage";

class SubscriptionLoadTimeoutError extends Error {
  constructor() { super("Subscription request timed out"); }
}

/** Bound the whole read, including auth waits before the HTTP request starts. */
export async function withSubscriptionTimeout<T>(read: (signal: AbortSignal) => Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) throw signal.reason;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout>;
  let onAbort: () => void;
  const interrupted = new Promise<never>((_, reject) => {
    onAbort = () => {
      controller.abort();
      reject(signal.reason ?? new DOMException("Request cancelled", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    timer = setTimeout(() => {
      controller.abort();
      reject(new SubscriptionLoadTimeoutError());
    }, 15_000);
  });
  try {
    return await Promise.race([interrupted, read(controller.signal)]);
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", onAbort);
  }
}

export function subscriptionLoadErrorMessage(error: unknown, lang: "zh" | "en"): string {
  const code = error && typeof error === "object" && "code" in error ? error.code : null;
  if (code === "PGRST205" || code === "42P01") {
    return lang === "zh" ? "订阅服务尚未完成初始化，请稍后重试。" : "Subscriptions are not set up yet. Please try again later.";
  }
  if (error instanceof SubscriptionLoadTimeoutError) {
    return lang === "zh" ? "加载超时，请检查网络后重试。" : "Loading timed out. Check your connection and try again.";
  }
  return getErrorMessage(error);
}
