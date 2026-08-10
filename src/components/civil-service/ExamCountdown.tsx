import { differenceInCalendarDays, parseISO, format } from "date-fns";
import { useLang } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";
import {
  useCivilExams,
  useCreateCivilExam,
  useUpdateCivilExam,
  useDeleteCivilExam,
  type CivilExam,
} from "@/hooks/useCivilService";
import { EXAM_TYPES } from "@/lib/civilServiceSubjects";
import { Plus, Star, Archive, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function ExamCountdown() {
  const { t } = useLang();
  const { data: exams = [] } = useCivilExams(false);
  const [manageOpen, setManageOpen] = useState(false);
  const today = new Date();
  const countdowns = exams
    .map((exam) => ({
      exam,
      daysLeft: differenceInCalendarDays(parseISO(exam.exam_date), today),
    }))
    .sort((a, b) => {
      const aUpcoming = a.daysLeft >= 0;
      const bUpcoming = b.daysLeft >= 0;
      if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
      return aUpcoming ? a.daysLeft - b.daysLeft : b.daysLeft - a.daysLeft;
    });
  const nearest = countdowns[0] ?? null;
  const laterTargets = countdowns.slice(1);

  return (
    <>
      <Card className="border-[#e4e1d7] bg-white overflow-hidden">
        <CardContent className="p-0">
          {nearest ? (
            <>
              <div className="flex items-center justify-between gap-3 border-b border-[#eeeae1] px-5 py-3.5">
                <p className="heading-font text-base font-medium text-[#1f1a14]">
                  {t("考试倒计时", "Exam countdown")}
                </p>
                <Button variant="outline" size="sm" onClick={() => setManageOpen(true)} className="border-[#e4e1d7]">
                  {t("管理考试", "Manage exams")}
                </Button>
              </div>
              <div className={laterTargets.length > 0 ? "grid lg:grid-cols-[minmax(0,1.45fr)_minmax(280px,1fr)]" : ""}>
                <div
                  data-countdown-size="primary"
                  className="bg-gradient-to-br from-[#fffaf5] to-white p-6 sm:p-7"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <span className="rounded-full bg-[#d17847]/10 px-2 py-0.5 text-[11px] font-medium text-[#b85f32]">
                      {t("最近目标", "Nearest target")}
                    </span>
                    {nearest.exam.is_primary ? (
                      <Star className="h-3.5 w-3.5 fill-[#d17847] text-[#d17847]" aria-label={t("重点目标", "Priority target")} />
                    ) : null}
                  </div>
                  <p className="text-sm font-medium text-[#5d574f]">{nearest.exam.name}</p>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="heading-font text-5xl font-semibold tracking-tight text-[#1f1a14] sm:text-6xl">
                      {Math.max(nearest.daysLeft, 0)}
                    </span>
                    <span className="text-lg text-[#8a847a]">{t("天", "days")}</span>
                  </div>
                  <p className="mt-2 text-[13px] text-[#8a847a]">
                    {t("考试日", "Exam date")} {format(parseISO(nearest.exam.exam_date), "yyyy-MM-dd")}
                    {nearest.daysLeft < 0 ? ` · ${t("已过期", "Passed")}` : ""}
                  </p>
                </div>
                {laterTargets.length > 0 ? (
                  <div className="grid gap-2 border-t border-[#eeeae1] bg-[#faf9f6] p-3 sm:grid-cols-2 lg:grid-cols-1 lg:border-l lg:border-t-0">
                    {laterTargets.map(({ exam, daysLeft }) => (
                      <div
                        key={exam.id}
                        data-countdown-size="secondary"
                        className="flex items-center justify-between gap-4 rounded-lg border border-[#e8e4db] bg-white px-4 py-3"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            {exam.is_primary ? (
                              <Star className="h-3 w-3 shrink-0 fill-[#d17847] text-[#d17847]" aria-label={t("重点目标", "Priority target")} />
                            ) : null}
                            <p className="truncate text-[13px] font-medium text-[#4d473f]">{exam.name}</p>
                          </div>
                          <p className="mt-1 text-[11px] text-[#9a948a]">
                            {format(parseISO(exam.exam_date), "yyyy-MM-dd")}
                            {daysLeft < 0 ? ` · ${t("已过期", "Passed")}` : ""}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-baseline gap-1">
                          <span className="heading-font text-2xl font-semibold text-[#5d574f]">{Math.max(daysLeft, 0)}</span>
                          <span className="text-xs text-[#9a948a]">{t("天", "days")}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="heading-font text-xl text-[#1f1a14]">{t("还没有考试倒计时", "No exam countdown yet")}</p>
                <p className="text-[13px] text-[#8a847a] mt-1">{t("添加国考 / 省考 / 事业编目标", "Add national / provincial / public institution exams")}</p>
              </div>
              <Button onClick={() => setManageOpen(true)} className="bg-[#d17847] hover:bg-[#c06838] text-white">
                <Plus className="h-4 w-4 mr-1" />
                {t("添加考试", "Add exam")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      <ExamManageDialog open={manageOpen} onOpenChange={setManageOpen} exams={exams} />
    </>
  );
}

function ExamManageDialog({
  open,
  onOpenChange,
  exams,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  exams: CivilExam[];
}) {
  const { t } = useLang();
  const { toast } = useToast();
  const createExam = useCreateCivilExam();
  const updateExam = useUpdateCivilExam();
  const deleteExam = useDeleteCivilExam();
  const [form, setForm] = useState({
    name: "",
    exam_date: "",
    exam_type: "国考",
    is_primary: exams.length === 0,
    notes: "",
  });

  const reset = () =>
    setForm({ name: "", exam_date: "", exam_type: "国考", is_primary: exams.length === 0, notes: "" });

  const handleCreate = async () => {
    if (!form.name.trim() || !form.exam_date) {
      toast({ title: t("请填写名称和日期", "Name and date required"), variant: "destructive" });
      return;
    }
    await createExam.mutateAsync(form);
    reset();
    toast({ title: t("已添加考试", "Exam added") });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="heading-font">{t("考试倒计时", "Exam countdown")}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {exams.map((exam) => (
            <div key={exam.id} className="rounded-lg border border-[#e4e1d7] p-3 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  {exam.is_primary && <Star className="h-3.5 w-3.5 text-[#d17847] fill-[#d17847]" />}
                  <p className="font-medium text-[#1f1a14] truncate">{exam.name}</p>
                </div>
                <p className="text-[12px] text-[#8a847a] mt-0.5">
                  {exam.exam_type} · {exam.exam_date}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                {!exam.is_primary && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    title={t("标记为重点目标", "Mark as priority")}
                    onClick={() => updateExam.mutate({ id: exam.id, is_primary: true })}
                  >
                    <Star className="h-3.5 w-3.5" />
                  </Button>
                )}
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  onClick={() => updateExam.mutate({ id: exam.id, is_archived: true, is_primary: false })}
                >
                  <Archive className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8 text-red-600"
                  onClick={() => deleteExam.mutate(exam.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
          {exams.length === 0 && (
            <p className="text-[13px] text-[#8a847a] text-center py-2">{t("暂无考试", "No exams yet")}</p>
          )}
        </div>

        <div className="border-t border-[#e4e1d7] pt-4 space-y-3">
          <p className="text-sm font-medium text-[#1f1a14]">{t("添加考试", "Add exam")}</p>
          <div className="space-y-2">
            <Label>{t("名称", "Name")}</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("如：2027国考", "e.g. 2027 National Exam")} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <Label>{t("类型", "Type")}</Label>
              <Select value={form.exam_type} onValueChange={(v) => setForm({ ...form, exam_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXAM_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("考试日", "Exam date")}</Label>
              <Input type="date" value={form.exam_date} onChange={(e) => setForm({ ...form, exam_date: e.target.value })} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t("备注", "Notes")}</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
          </div>
          <label className="flex items-center gap-2 text-sm text-[#1f1a14]">
            <Checkbox checked={form.is_primary} onCheckedChange={(v) => setForm({ ...form, is_primary: !!v })} />
            {t("标记为重点目标", "Mark as priority target")}
          </label>
        </div>

        <DialogFooter>
          <Button onClick={handleCreate} className="bg-[#d17847] hover:bg-[#c06838] text-white">
            {t("添加", "Add")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
