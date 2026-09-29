import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  createNewspaperDemo,
  executeNewspaperDemo,
  NEWSPAPER_DEMO_KEY,
  type NewspaperDemoState,
} from "@/lib/newspaperDemo";
import {
  NEWSPAPER_PAID_REQUEST_EVENT,
  type NewspaperPaidRequest,
  newspaperPaidRequestStore,
} from "@/lib/newspaperPaidRequests";
import type {
  NewspaperImageConfig,
  NewspaperListItem,
  NewspaperPreferences,
  NewspaperReport,
  NewspaperStyle,
} from "../../supabase/functions/_shared/newspaperTypes";
export type {
  NewspaperImageConfig,
  NewspaperPreferences,
  NewspaperReport,
  NewspaperStyle,
};
let memoryDemo: NewspaperDemoState | undefined;
function loadDemo() {
  if (memoryDemo) return memoryDemo;
  try {
    const saved = sessionStorage.getItem(NEWSPAPER_DEMO_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed.reports)) memoryDemo = parsed;
    }
  } catch {
    /* A blocked store still permits the current browser-session demo. */
  }
  return memoryDemo ||= createNewspaperDemo();
}
export async function callNewspaper<T>(
  action: string,
  input: Record<string, unknown> = {},
  demo = false,
  idempotencyKey?: string,
): Promise<T> {
  if (demo) {
    const result = executeNewspaperDemo(loadDemo(), action, input);
    memoryDemo = result.state;
    try {
      sessionStorage.setItem(NEWSPAPER_DEMO_KEY, JSON.stringify(memoryDemo));
    } catch {
      /* Demo remains available in memory when browser storage is full. */
    }
    return result.data as T;
  }
  const { data, error } = await supabase.functions.invoke("newspaper", {
    body: {
      action,
      input,
      ...(idempotencyKey ? { idempotency_key: idempotencyKey } : {}),
    },
  });
  if (error) {
    let message = error.message;
    let code: string | undefined;
    try {
      const body = await error.context?.json();
      message = body?.error?.message || body?.error || message;
      code = body?.error?.code || body?.code;
    } catch { /* retain network error */ }
    throw Object.assign(
      new Error(
        typeof message === "string" ? message : "日报请求失败，请稍后重试。",
      ),
      { code },
    );
  }
  if (data?.error) {
    throw Object.assign(new Error(data.error.message || String(data.error)), {
      code: data.error.code || data.code,
    });
  }
  return data?.data as T;
}
export function useNewspaperQuery<T>(
  action: string,
  input: Record<string, unknown> = {},
  enabled = true,
) {
  const { isDemo } = useDemoMode();
  const { user } = useAuth();
  return useQuery({
    queryKey: ["newspaper", isDemo ? "demo" : user?.id, action, input],
    queryFn: async () => {
      const result = await callNewspaper<T>(action, input, isDemo);
      if (action === "get") {
        newspaperPaidRequestStore().reconcileImages(
          isDemo ? "demo" : user!.id,
          String(input.date),
          (result as NewspaperReport)?.jobs || [],
        );
      }
      return result;
    },
    enabled: enabled && (isDemo || !!user),
    retry: false,
    staleTime: 15000,
  });
}
export function useNewspapers(search = "", offset = 0) {
  return useNewspaperQuery<
    { items: NewspaperListItem[]; hasMore: boolean; nextOffset: number | null }
  >("list", { limit: 100, offset, ...(search ? { q: search } : {}) });
}
export function useNewspaper(date?: string) {
  return useNewspaperQuery<NewspaperReport>("get", { date }, !!date);
}
export function useNewspaperPreferences() {
  return useNewspaperQuery<NewspaperPreferences>("preferences_get");
}
export function useNewspaperStyles() {
  return useNewspaperQuery<NewspaperStyle[]>("style_list");
}
export function useNewspaperImageConfig() {
  return useNewspaperQuery<NewspaperImageConfig>("image_config_get");
}
export function useNewspaperCommand() {
  const { isDemo } = useDemoMode();
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      { action, input = {}, idempotencyKey }: {
        action: string;
        input?: Record<string, unknown>;
        idempotencyKey?: string;
      },
    ) => {
      if (action === "image_generate" || action === "review_generate") {
        if (!isDemo && !user?.id) throw new Error("请先登录后生成。");
        return newspaperPaidRequestStore().run(
          isDemo ? "demo" : user!.id,
          action,
          input,
          (key) => callNewspaper<any>(action, input, isDemo, key),
          idempotencyKey,
        );
      }
      return callNewspaper<any>(
        action,
        input,
        isDemo,
        idempotencyKey || crypto.randomUUID(),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["newspaper"] }),
  });
}
export function usePendingNewspaperRequest(action: string, date: string) {
  const { isDemo } = useDemoMode();
  const { user } = useAuth();
  const scope = isDemo ? "demo" : user?.id;
  const [requests, setRequests] = useState<NewspaperPaidRequest[]>([]);
  useEffect(() => {
    const update = () =>
      setRequests(
        scope ? newspaperPaidRequestStore().pending(scope, action, date) : [],
      );
    update();
    window.addEventListener(NEWSPAPER_PAID_REQUEST_EVENT, update);
    return () =>
      window.removeEventListener(NEWSPAPER_PAID_REQUEST_EVENT, update);
  }, [scope, action, date]);
  return requests;
}
