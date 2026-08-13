import { useState } from "react";
import { format } from "date-fns";
import { useLang } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  useTodayCivilPlans,
  useToggleCivilPlanComplete,
  useCreateCivilPlanItem,
  useUpdateCivilPlanItem,
  useDeleteCivilPlanItem,
  type CivilPlanItem,
} from "@/hooks/useCivilService";
import { PlanItemForm } from "./PlanItemForm";
import { SyncPlanButton } from "./SyncPlanButton";
import { isPlanSynced } from "@/lib/civilPlanSync";
import { SUBJECT_GROUP_LABELS, type SubjectGroup } from "@/lib/civilServiceSubjects";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function DailyPlanList() {
  const { t } = useLang();
  const { toast } = useToast();
  const { data: items = [] } = useTodayCivilPlans();
  const toggle = useToggleCivilPlanComplete();
  const createItem = useCreateCivilPlanItem();
  const updateItem = useUpdateCivilPlanItem();
  const deleteItem = useDeleteCivilPlanItem();

  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<CivilPlanItem | null>(null);
  const [pendingSyncAsk, setPendingSyncAsk] = useState<{
    item: CivilPlanItem;
    updates: Record<string, any>;
  } | null>(null);

  const done = items.filter((i) => i.is_completed).length;

  const handleCreate = async (values: any) => {
    await createItem.mutateAsync({
      ...values,
      plan_date: format(new Date(), "yyyy-MM-dd"),
      source: "daily_extra",
    });
    setAddOpen(false);
    toast({ title: t("已添加今日计划", "Daily plan added") });
  };

  const handleEditSubmit = async (values: any) => {
    if (!editItem) return;
    if (isPlanSynced(editItem)) {
      setPendingSyncAsk({ item: editItem, updates: values });
      return;
    }
    await updateItem.mutateAsync({ id: editItem.id, ...values });
    setEditItem(null);
    toast({ title: t("已更新", "Updated") });
  };

  const applyEdit = async (alsoSync: boolean) => {
    if (!pendingSyncAsk) return;
    const { item, updates } = pendingSyncAsk;
    await updateItem.mutateAsync({ id: item.id, ...updates });
    setEditItem(null);
    setPendingSyncAsk(null);
    if (alsoSync) {
      // Sync handled by re-opening sync with updated item via invalidate; user can tap sync
      // Better: sync immediately with merged item
      const { syncCivilPlanItem } = await import("@/lib/civilPlanSync");
      try {
        await syncCivilPlanItem({ ...item, ...updates });
        toast({ title: t("已更新并同步", "Updated and synced") });
      } catch {
        toast({ title: t("已更新，同步失败", "Updated, sync failed"), variant: "destructive" });
      }
    } else {
      toast({ title: t("已更新（未同步主模式）", "Updated (main mode not synced)") });
    }
  };

  return (
    <>
      <Card className="border-border bg-white">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base heading-font">
            {t("每日计划", "Daily plan")}
            <span className="ml-2 text-[13px] font-normal text-muted-foreground font-mono-data">
              {done}/{items.length}
            </span>
          </CardTitle>
          <Button size="sm" variant="outline" className="border-border" onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            {t("额外项", "Extra")}
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {items.length === 0 && (
            <p className="text-[13px] text-muted-foreground py-4 text-center">
              {t("今天还没有计划，可在科目页添加，或点「额外项」", "No plans today — add in subjects or as extra")}
            </p>
          )}
          {items.map((item) => {
            const groupLabel = SUBJECT_GROUP_LABELS[item.subject_group as SubjectGroup]?.zh || item.subject_group;
            return (
              <div
                key={item.id}
                className={`flex items-start gap-2 rounded-lg border border-border p-3 ${item.is_completed ? "opacity-60" : ""}`}
              >
                <Checkbox
                  checked={item.is_completed}
                  onCheckedChange={() => toggle.mutate(item)}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm text-foreground ${item.is_completed ? "line-through" : ""}`}>{item.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {groupLabel}
                    {item.subject_tag ? ` · ${item.subject_tag}` : ""}
                    {item.source === "daily_extra" ? ` · ${t("今日额外", "Extra")}` : ""}
                    {item.start_time ? ` · ${format(new Date(item.start_time), "HH:mm")}` : ""}
                  </p>
                </div>
                <div className="flex shrink-0">
                  <SyncPlanButton item={item} size="icon" />
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditItem(item)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600" onClick={() => deleteItem.mutate(item.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="heading-font">{t("添加今日额外计划", "Add today's extra plan")}</DialogTitle>
          </DialogHeader>
          <PlanItemForm
            defaultDate={format(new Date(), "yyyy-MM-dd")}
            hideDate
            onSubmit={handleCreate}
            onCancel={() => setAddOpen(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editItem && !pendingSyncAsk} onOpenChange={(o) => !o && setEditItem(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="heading-font">{t("编辑计划", "Edit plan")}</DialogTitle>
          </DialogHeader>
          {editItem && (
            <PlanItemForm
              initial={editItem}
              onSubmit={handleEditSubmit}
              onCancel={() => setEditItem(null)}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!pendingSyncAsk} onOpenChange={(o) => !o && setPendingSyncAsk(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="heading-font">{t("同步更新主模式？", "Also sync to main mode?")}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {t("该计划已同步到日程或待办，是否一并更新？", "This plan was synced. Update the linked schedule/todo too?")}
          </p>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => applyEdit(false)}>{t("仅更新考公", "Civil only")}</Button>
            <Button className="bg-[#d17847] hover:bg-[#c06838] text-white" onClick={() => applyEdit(true)}>
              {t("更新并同步", "Update & sync")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
