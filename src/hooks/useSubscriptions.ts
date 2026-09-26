import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useDemoMode } from "@/contexts/DemoModeContext";
import type { Subscription, SubscriptionPayment } from "@/lib/subscriptions";
import { prepareDemoPayment } from "@/lib/subscriptionDemo";
import { withSubscriptionTimeout } from "@/lib/subscriptionQuery";
import { normalizeSubscription, normalizeSubscriptionPayment, subscriptionPaymentRpcArgs, type SubscriptionPaymentInput } from "../../supabase/functions/_shared/subscriptionOperations";

export function useSubscriptions(enabled = true) {
  const { isDemo, demoData } = useDemoMode();
  const query = useQuery({
    queryKey: ["subscriptions"], enabled: enabled && !isDemo,
    retry: false,
    queryFn: ({ signal }) => withSubscriptionTimeout(async requestSignal => {
      const rows: Subscription[] = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supabase.from("subscriptions").select("*").order("id").range(offset, offset + 999).abortSignal(requestSignal);
        if (error) throw error;
        rows.push(...data as Subscription[]);
        if (data.length < 1000) break;
      }
      return rows;
    }, signal),
  });
  return isDemo ? { ...query, data: enabled ? demoData.subscriptions : [], isLoading: false, error: null } : query;
}
export function useSubscriptionPayments(id?: string) {
  const { isDemo, demoData } = useDemoMode();
  const query = useQuery({
    queryKey: ["subscription_payments", id], enabled: !isDemo && !!id,
    retry: false,
    queryFn: ({ signal }) => withSubscriptionTimeout(async requestSignal => {
      const rows: SubscriptionPayment[] = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supabase.from("subscription_payments").select("*").eq("subscription_id", id!).order("paid_on", { ascending: false }).order("id").range(offset, offset + 999).abortSignal(requestSignal);
        if (error) throw error;
        rows.push(...data as SubscriptionPayment[]);
        if (data.length < 1000) break;
      }
      return rows;
    }, signal),
  });
  return isDemo ? { ...query, data: demoData.subscription_payments.filter(p => p.subscription_id === id).sort((a, b) => b.paid_on.localeCompare(a.paid_on)), isLoading: false, error: null } : query;
}
export function useSubscriptionMutations() {
  const demo = useDemoMode();
  const qc = useQueryClient();
  // Keep immediate demo retries idempotent even before React commits the new context.
  const paid = useRef<SubscriptionPayment[]>([]);
  const invalidate = async () => { await Promise.all(["subscriptions", "subscription_payments", "finance"].map(key => qc.invalidateQueries({ queryKey: [key] }))); };
  const save = useMutation({
    mutationFn: async ({ id, expected_updated_at, ...input }: Record<string, unknown> & { id?: string; expected_updated_at?: string }) => {
      const row = normalizeSubscription(input) as Database["public"]["Tables"]["subscriptions"]["Insert"];
      if (demo.isDemo) {
        if (id) {
          if (expected_updated_at && demo.demoData.subscriptions.find(s => s.id === id)?.updated_at !== expected_updated_at) throw new Error("订阅已在别处修改，请重新打开编辑后重试");
          demo.updateRecord("subscriptions", id, row); return { id, ...row };
        }
        return demo.addRecord("subscriptions", { ...row, id: crypto.randomUUID() });
      }
      const query = id ? supabase.from("subscriptions").update(row).eq("id", id) : supabase.from("subscriptions").insert(row);
      if (id && expected_updated_at) query.eq("updated_at", expected_updated_at);
      const { data, error } = await query.select().single();
      if (error) {
        if (error.code === "PGRST116") throw new Error("订阅已在别处修改或删除，请重新打开编辑后重试");
        throw error;
      }
      return data;
    }, onSuccess: invalidate, onError: invalidate,
  });
  const remove = useMutation({
    mutationFn: async (id: string) => {
      if (demo.isDemo) {
        demo.deleteRecord("subscriptions", id);
        demo.demoData.subscription_payments.filter(p => p.subscription_id === id).forEach(p => demo.deleteRecord("subscription_payments", p.id));
        return;
      }
      const { error } = await supabase.from("subscriptions").delete().eq("id", id);
      if (error) throw error;
    }, onSuccess: invalidate,
  });
  const confirmPayment = useMutation({
    mutationFn: async (raw: SubscriptionPaymentInput) => {
      const input = normalizeSubscriptionPayment({ ...raw });
      if (demo.isDemo) {
        const sub = demo.demoData.subscriptions.find(s => s.id === input.subscription_id);
        if (!sub) throw new Error("未找到订阅");
        const prepared = prepareDemoPayment(sub, [...demo.demoData.subscription_payments, ...paid.current], input);
        if (!prepared.duplicate) {
          paid.current.push(prepared.payment);
          demo.addRecord("subscription_payments", prepared.payment);
          if (prepared.expense) demo.addRecord("finance_records", prepared.expense);
          demo.updateRecord("subscriptions", sub.id, { status: "active", next_date: input.next_date });
        }
        return prepared.payment;
      }
      const { data, error } = await supabase.rpc("confirm_subscription_payment", subscriptionPaymentRpcArgs(input));
      if (error) throw error;
      return data;
    }, onSuccess: invalidate,
  });
  return { save, remove, confirmPayment };
}
