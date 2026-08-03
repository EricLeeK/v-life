import { useState } from "react";
import { useLang } from "@/contexts/LanguageContext";
import { useSettings } from "@/hooks/useData";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { syncCivilPlanItem, isPlanSynced } from "@/lib/civilPlanSync";
import type { CivilPlanItem } from "@/hooks/useCivilService";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { RefreshCw, Check } from "lucide-react";

export function SyncPlanButton({ item, size = "sm" }: { item: CivilPlanItem; size?: "sm" | "icon" }) {
  const { t } = useLang();
  const { toast } = useToast();
  const { isDemo, updateRecord } = useDemoMode();
  const settings = useSettings();
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const focusMode = (settings.data as any)?.app_focus_mode || "full";

  if (focusMode === "civil_service") return null;

  const synced = isPlanSynced(item);

  const handleSync = async () => {
    setLoading(true);
    try {
      if (isDemo) {
        const hasTime = !!(item.start_time && item.end_time);
        updateRecord("civil_plan_items", item.id, {
          synced_schedule_id: hasTime ? `demo-synced-sch-${item.id}` : null,
          synced_todo_id: hasTime ? null : `demo-synced-todo-${item.id}`,
        });
        qc.invalidateQueries({ queryKey: ["civil_plan_items"] });
        toast({ title: t("已同步（演示）", "Synced (demo)") });
      } else {
        await syncCivilPlanItem(item);
        qc.invalidateQueries({ queryKey: ["civil_plan_items"] });
        qc.invalidateQueries({ queryKey: ["schedule"] });
        qc.invalidateQueries({ queryKey: ["todos"] });
        toast({
          title: item.start_time && item.end_time
            ? t("已同步到日程", "Synced to schedule")
            : t("已同步到待办（考公）", "Synced to todos (Civil)"),
        });
      }
    } catch (e: any) {
      toast({ title: t("同步失败", "Sync failed"), description: e?.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (size === "icon") {
    return (
      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={handleSync} disabled={loading} title={t("同步到主模式", "Sync to main")}>
        {synced ? <Check className="h-3.5 w-3.5 text-[#5b8c44]" /> : <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />}
      </Button>
    );
  }

  return (
    <Button size="sm" variant="outline" className="border-[#e4e1d7] text-[12px]" onClick={handleSync} disabled={loading}>
      <RefreshCw className={`h-3 w-3 mr-1 ${loading ? "animate-spin" : ""}`} />
      {synced ? t("重新同步", "Re-sync") : t("同步", "Sync")}
    </Button>
  );
}
