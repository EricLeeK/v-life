import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

function shanghaiDatePrefix(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function startOfShanghaiDayIso(d = new Date()): string {
  return new Date(`${shanghaiDatePrefix(d)}T00:00:00+08:00`).toISOString();
}

function startOfShanghaiMonthIso(d = new Date()): string {
  const [y, m] = shanghaiDatePrefix(d).split("-");
  return new Date(`${y}-${m}-01T00:00:00+08:00`).toISOString();
}

export function useHostedAiStatus() {
  return useQuery({
    queryKey: ["ai-hosted-status"],
    queryFn: async () => {
      const { data: entitlement, error: entError } = await supabase
        .from("ai_entitlements")
        .select("*")
        .maybeSingle();
      if (entError) throw entError;

      const monthStart = startOfShanghaiMonthIso();
      const dayStart = startOfShanghaiDayIso();

      const [{ data: monthRows, error: monthError }, { count: dailyUsed, error: dayError }] =
        await Promise.all([
          supabase
            .from("ai_usage_logs")
            .select("total_tokens")
            .eq("source", "hosted")
            .gte("created_at", monthStart),
          supabase
            .from("ai_usage_logs")
            .select("id", { count: "exact", head: true })
            .eq("source", "hosted")
            .gte("created_at", dayStart),
        ]);

      if (monthError) throw monthError;
      if (dayError) throw dayError;

      const monthlyUsed = (monthRows || []).reduce(
        (sum, row) => sum + (row.total_tokens || 0),
        0,
      );

      const active =
        !!entitlement &&
        entitlement.status === "active" &&
        (!entitlement.expires_at || new Date(entitlement.expires_at).getTime() > Date.now());

      return {
        entitlement,
        active,
        monthlyUsed,
        dailyUsed: dailyUsed ?? 0,
      };
    },
  });
}
