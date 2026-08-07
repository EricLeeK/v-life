import { useMemo, useState, useEffect } from "react";
import { format } from "date-fns";
import { useLang } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useCivilWrongAnswers,
  useCreateCivilWrongAnswer,
  useDeleteCivilWrongAnswer,
  useReviewCivilWrongAnswer,
  type CivilWrongAnswer,
} from "@/hooks/useCivilService";
import { WrongAnswerForm } from "./WrongAnswerForm";
import { WrongAnswerCard } from "./WrongAnswerCard";
import type { SubjectGroup } from "@/lib/civilServiceSubjects";
import { masteredReviewFields, resetPendingReviewFields } from "@/lib/civilXingcePaper";
import { Plus, Trash2, CheckCircle2, Pencil, ChevronDown, ChevronRight, Undo2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function WrongAnswerList({ subjectGroup }: { subjectGroup?: SubjectGroup }) {
  const { t } = useLang();
  const { toast } = useToast();
  const today = format(new Date(), "yyyy-MM-dd");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "due" | "mastered">("all");
  const { data: raw = [] } = useCivilWrongAnswers({
    subject_group: subjectGroup,
    review_status: statusFilter === "mastered" ? "mastered" : statusFilter === "all" ? undefined : "pending",
  });
  const items = useMemo(() => {
    if (statusFilter === "due") {
      return raw.filter((w) => w.review_status === "pending" && w.next_review_date && w.next_review_date <= today);
    }
    if (statusFilter === "pending") {
      return raw.filter((w) => w.review_status === "pending");
    }
    return raw;
  }, [raw, statusFilter, today]);

  const createWrong = useCreateCivilWrongAnswer();
  const deleteWrong = useDeleteCivilWrongAnswer();
  const review = useReviewCivilWrongAnswer();
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState<CivilWrongAnswer | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!confirmDeleteId) return;
    const timer = window.setTimeout(() => setConfirmDeleteId(null), 4000);
    return () => window.clearTimeout(timer);
  }, [confirmDeleteId]);

  return (
    <>
      <Card className="border-[#e4e1d7] bg-white">
        <CardHeader className="pb-2 flex flex-row items-center justify-between gap-2">
          <CardTitle className="text-base heading-font">{t("错题本", "Wrong answers")}</CardTitle>
          <Button size="sm" className="bg-[#d17847] hover:bg-[#c06838] text-white" onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            {t("记录错题", "Add")}
          </Button>
        </CardHeader>
        <CardContent className="space-y-3">
          <Tabs value={statusFilter} onValueChange={(v) => { setStatusFilter(v as any); setConfirmDeleteId(null); }}>
            <TabsList className="bg-[#f4f3ee] flex-wrap h-auto">
              <TabsTrigger value="all">{t("全部", "All")}</TabsTrigger>
              <TabsTrigger value="due">{t("今日到期", "Due")}</TabsTrigger>
              <TabsTrigger value="pending">{t("待复习", "Review")}</TabsTrigger>
              <TabsTrigger value="mastered">{t("已掌握", "Mastered")}</TabsTrigger>
            </TabsList>
          </Tabs>

          {items.length === 0 && (
            <p className="text-[13px] text-[#8a847a] text-center py-6">{t("暂无错题", "No wrong answers yet")}</p>
          )}

          {items.map((item) => {
            const isExpanded = expandedId === item.id;
            return (
              <div
                key={item.id}
                className="rounded-lg border border-[#e4e1d7] overflow-hidden"
              >
                <div
                  className="p-3 cursor-pointer hover:bg-[#faf9f6]"
                  onClick={() => setExpandedId(isExpanded ? null : item.id)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1">
                        {isExpanded ? (
                          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#8a847a]" />
                        ) : (
                          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#8a847a]" />
                        )}
                        <p className="text-sm font-medium text-[#1f1a14] truncate">{item.title}</p>
                      </div>
                      <p className="text-[11px] text-[#8a847a] mt-0.5 ml-[18px]">
                        {item.subject_tag || item.subject_group} · {item.source_date}
                        {item.review_status === "pending"
                          ? ` · ${t("待复习", "To review")}`
                          : ` · ${t("已掌握", "Mastered")}`}
                        {item.next_review_date ? ` · ${t("下次", "Next")} ${item.next_review_date}` : ""}
                      </p>
                      {!isExpanded && item.knowledge_point && (
                        <p className="text-[12px] text-[#5a9da8] mt-1 ml-[18px]">{item.knowledge_point}</p>
                      )}
                    </div>
                    <div className="flex shrink-0" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-[#8a847a]"
                        title={t("编辑", "Edit")}
                        onClick={() => setEditItem(item)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      {item.review_status === "pending" && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-[#5b8c44]"
                          title={t("标为已掌握", "Mark mastered")}
                          onClick={async () => {
                            await review.markMastered(item);
                            toast({ title: t("已标为掌握", "Marked mastered") });
                          }}
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {item.review_status === "mastered" && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-[#8a847a] hover:text-[#d17847]"
                          title={t("撤销掌握", "Undo mastered")}
                          onClick={async () => {
                            await review.resetPending(item);
                            toast({ title: t("已恢复为待复习", "Restored to review") });
                          }}
                        >
                          <Undo2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className={[
                          "h-8 min-w-8 px-1",
                          confirmDeleteId === item.id
                            ? "text-white bg-red-600 hover:bg-red-700 hover:text-white"
                            : "w-8 text-red-600",
                        ].join(" ")}
                        title={
                          confirmDeleteId === item.id
                            ? t("再次点击确认删除", "Click again to confirm delete")
                            : t("删除", "Delete")
                        }
                        onClick={() => {
                          if (confirmDeleteId === item.id) {
                            deleteWrong.mutate(item.id);
                            setConfirmDeleteId(null);
                            if (expandedId === item.id) setExpandedId(null);
                          } else {
                            setConfirmDeleteId(item.id);
                          }
                        }}
                      >
                        {confirmDeleteId === item.id ? (
                          <span className="text-[10px] font-medium leading-none">{t("确认", "OK")}</span>
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
                {isExpanded && (
                  <div className="px-3 pb-3 border-t border-[#e4e1d7] pt-3 bg-[#faf9f6]/50">
                    <WrongAnswerCard item={item} />
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="heading-font">{t("记录错题", "Add wrong answer")}</DialogTitle>
          </DialogHeader>
          <WrongAnswerForm
            defaultGroup={subjectGroup}
            onCancel={() => setAddOpen(false)}
            onSubmit={async (values) => {
              await createWrong.mutateAsync(values);
              setAddOpen(false);
              toast({ title: t("错题已保存", "Saved") });
            }}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={!!editItem} onOpenChange={(o) => !o && setEditItem(null)}>
        <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="heading-font">{t("编辑错题", "Edit wrong answer")}</DialogTitle>
          </DialogHeader>
          {editItem && (
            <WrongAnswerForm
              initial={editItem}
              onCancel={() => setEditItem(null)}
              onSubmit={async (values) => {
                const reviewFields =
                  values.review_status === "mastered"
                    ? masteredReviewFields()
                    : editItem.review_status === "mastered" && values.review_status === "pending"
                      ? resetPendingReviewFields(values.source_date)
                      : {};
                await review.mutateAsync({ id: editItem.id, ...values, ...reviewFields });
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
