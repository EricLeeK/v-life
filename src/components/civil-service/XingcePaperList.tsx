import { useState } from "react";
import { useLang } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  useCivilXingcePapers,
  useCreateCivilXingcePaper,
  useUpdateCivilXingcePaper,
  useDeleteCivilXingcePaper,
} from "@/hooks/useCivilService";
import { XingcePaperForm } from "./XingcePaperForm";
import { paperTotals, type CivilXingcePaper } from "@/lib/civilXingcePaper";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function XingcePaperList() {
  const { t } = useLang();
  const { toast } = useToast();
  const { data: papers = [] } = useCivilXingcePapers();
  const createPaper = useCreateCivilXingcePaper();
  const updatePaper = useUpdateCivilXingcePaper();
  const deletePaper = useDeleteCivilXingcePaper();
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<CivilXingcePaper | null>(null);

  const sorted = [...papers].sort((a, b) => b.taken_date.localeCompare(a.taken_date));

  return (
    <>
      <Card className="border-[#e4e1d7] bg-white">
        <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base heading-font">{t("行测套卷", "Xingce papers")}</CardTitle>
          <Button size="sm" className="bg-[#d17847] hover:bg-[#c06838] text-white" onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            {t("录入套卷", "Add paper")}
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {sorted.length === 0 && (
            <p className="text-[13px] text-[#8a847a] text-center py-6">
              {t("还没有套卷记录", "No papers yet")}
            </p>
          )}
          {sorted.map((paper) => {
            const stats = paperTotals(paper);
            return (
              <div key={paper.id} className="rounded-lg border border-[#e4e1d7] p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#1f1a14] truncate">
                      {paper.source}
                      {paper.is_mock ? (
                        <span className="ml-2 text-[10px] text-[#d17847] bg-[#fce0c8] px-1.5 py-0.5 rounded">
                          {t("模考", "Mock")}
                        </span>
                      ) : null}
                    </p>
                    <p className="text-[11px] text-[#8a847a] mt-0.5 font-mono-data">
                      {paper.taken_date}
                      {" · "}
                      {stats.correct}/{stats.total}
                      {stats.overallRate != null ? ` · ${stats.overallRate}%` : ""}
                      {paper.total_score != null ? ` · ${t("分", "pt")} ${paper.total_score}` : ""}
                      {paper.beat_rate != null ? ` · ${t("击败", "Beat")} ${paper.beat_rate}%` : ""}
                      {paper.duration_minutes != null ? ` · ${paper.duration_minutes}${t("分", "m")}` : ""}
                    </p>
                    {paper.notes && (
                      <p className="text-[12px] text-[#8a847a] mt-1 line-clamp-2">{paper.notes}</p>
                    )}
                  </div>
                  <div className="flex shrink-0">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditItem(paper)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-red-600"
                      onClick={() => {
                        deletePaper.mutate(paper.id);
                        toast({ title: t("已删除", "Deleted") });
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="heading-font">{t("录入行测套卷", "Add Xingce paper")}</DialogTitle>
          </DialogHeader>
          <XingcePaperForm
            onCancel={() => setAddOpen(false)}
            onSubmit={async (values) => {
              await createPaper.mutateAsync(values);
              setAddOpen(false);
              toast({ title: t("套卷已保存", "Paper saved") });
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editItem} onOpenChange={(o) => !o && setEditItem(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="heading-font">{t("编辑套卷", "Edit paper")}</DialogTitle>
          </DialogHeader>
          {editItem && (
            <XingcePaperForm
              initial={editItem}
              onCancel={() => setEditItem(null)}
              onSubmit={async (values) => {
                await updatePaper.mutateAsync({ id: editItem.id, ...values });
                setEditItem(null);
                toast({ title: t("已更新", "Updated") });
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
