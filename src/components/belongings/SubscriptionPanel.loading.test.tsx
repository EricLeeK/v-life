import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { SubscriptionPanel } from "./SubscriptionPanel";

const api = vi.hoisted(() => ({ from: vi.fn(), response: vi.fn(), signals: [] as AbortSignal[] }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: api.from } }));
vi.mock("@/contexts/DemoModeContext", () => ({ useDemoMode: () => ({ isDemo: false }) }));
vi.mock("@/contexts/LanguageContext", () => ({ useLang: () => ({ lang: "zh", t: (zh: string) => zh }) }));
vi.mock("@/hooks/useLocalDate", () => ({ useLocalDate: () => "2026-09-25" }));
const clients: QueryClient[] = [];

beforeEach(() => {
  api.signals.length = 0;
  api.response.mockReset();
  api.from.mockReset().mockImplementation(() => {
    const query = {
      select: () => query,
      order: () => query,
      range: () => query,
      abortSignal: (signal: AbortSignal) => { api.signals.push(signal); return query; },
      then: (resolve, reject) => api.response().then(resolve, reject),
    };
    return query;
  });
});
afterEach(() => {
  cleanup();
  clients.splice(0).forEach(client => client.clear());
  vi.useRealTimers();
});

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } });
  clients.push(client);
  return render(<QueryClientProvider client={client}><SubscriptionPanel /></QueryClientProvider>);
}

it("explains an unavailable subscription service immediately and allows recovery by retrying", async () => {
  api.response.mockResolvedValue({ data: null, error: { code: "PGRST205", message: "Could not find public.subscriptions" } });
  mount();
  expect(await screen.findByRole("alert")).toHaveTextContent("订阅服务尚未完成初始化，请稍后重试。");
  expect(api.from).toHaveBeenCalledTimes(1);
  expect(screen.queryByText("正在加载订阅…")).not.toBeInTheDocument();
  api.response.mockResolvedValue({ data: [], error: null });
  fireEvent.click(screen.getByRole("button", { name: "重试" }));
  await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  expect(screen.getByRole("region", { name: "订阅服务" })).toBeInTheDocument();
});

it("ends loading when a request never resolves, aborts it and offers retry", async () => {
  vi.useFakeTimers();
  api.response.mockImplementation(() => new Promise(() => {}));
  mount();
  expect(screen.getByRole("status")).toHaveTextContent("正在加载订阅");
  await act(async () => { await vi.advanceTimersByTimeAsync(15001); });
  expect(screen.getByRole("alert")).toHaveTextContent("加载超时，请检查网络后重试。");
  expect(api.signals[0].aborted).toBe(true);
  expect(screen.getByRole("button", { name: "重试" })).toBeEnabled();
});

it("aborts the subscription request when leaving the page", async () => {
  api.response.mockImplementation(() => new Promise(() => {}));
  const view = mount();
  await act(async () => {});
  view.unmount();
  expect(api.signals[0]?.aborted).toBe(true);
});
