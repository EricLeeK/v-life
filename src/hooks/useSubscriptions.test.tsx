import type { ReactNode } from "react";
import { act, cleanup, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { DemoModeProvider, useDemoMode } from "@/contexts/DemoModeContext";
import { useSubscriptionMutations, useSubscriptions } from "./useSubscriptions";
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
beforeEach(() => localStorage.setItem("vlife-demo-mode", "true"));
afterEach(() => { cleanup(); localStorage.clear(); });
const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={new QueryClient()}><DemoModeProvider>{children}</DemoModeProvider></QueryClientProvider>;
it("saves normalized data, atomically confirms rapid retries, and cascades subscription deletion", async () => {
  const { result } = renderHook(() => ({ list: useSubscriptions(), mutations: useSubscriptionMutations(), demo: useDemoMode() }), { wrapper });
  let id = "";
  await act(async () => {
    const sub = await result.current.mutations.save.mutateAsync({name:"测试年费",url:"example.org",amount:120,currency:"USD",billing_interval:12,next_date:"2026-01-31"});
    id = sub.id;
  });
  expect(result.current.list.data.find(s => s.id === id)).toMatchObject({url:"https://example.org/",anchor_day:31,amount:120});
  const input = {subscription_id:id,due_date:"2026-01-31",paid_on:"2026-01-31",amount:100,next_date:"2027-01-31",record_expense:true,exchange_rate:7};
  await act(async () => { await Promise.all([result.current.mutations.confirmPayment.mutateAsync(input),result.current.mutations.confirmPayment.mutateAsync(input)]); });
  expect(result.current.demo.demoData.subscription_payments.filter(p => p.subscription_id === id)).toHaveLength(1);
  expect(result.current.demo.demoData.finance_records.filter(p => p.name === "订阅 · 测试年费")).toHaveLength(1);
  expect(result.current.list.data.find(s => s.id === id)).toMatchObject({next_date:"2027-01-31",amount:120});
  await act(async () => { await result.current.mutations.remove.mutateAsync(id); });
  expect(result.current.demo.demoData.subscription_payments.filter(p => p.subscription_id === id)).toHaveLength(0);
  expect(result.current.demo.demoData.finance_records.find(p => p.name === "订阅 · 测试年费")).toMatchObject({amount:100,amount_cny:700});
});
