import { useState, useEffect } from "react";
import { useLang } from "@/contexts/LanguageContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  SUBJECT_GROUP_LABELS,
  SUBJECT_GROUPS,
  tagsForGroup,
  type SubjectGroup,
} from "@/lib/civilServiceSubjects";
import type { CivilPlanItem } from "@/hooks/useCivilService";

type FormValues = {
  title: string;
  detail: string | null;
  plan_date: string;
  subject_group: string;
  subject_tag: string | null;
  start_time: string | null;
  end_time: string | null;
};

function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(local: string): string | null {
  if (!local) return null;
  return new Date(local).toISOString();
}

export function PlanItemForm({
  initial,
  defaultDate,
  defaultGroup,
  hideDate,
  onSubmit,
  onCancel,
}: {
  initial?: CivilPlanItem;
  defaultDate?: string;
  defaultGroup?: SubjectGroup;
  hideDate?: boolean;
  onSubmit: (values: FormValues) => void | Promise<void>;
  onCancel?: () => void;
}) {
  const { t } = useLang();
  const [title, setTitle] = useState(initial?.title || "");
  const [detail, setDetail] = useState(initial?.detail || "");
  const [planDate, setPlanDate] = useState(initial?.plan_date || defaultDate || "");
  const [group, setGroup] = useState<SubjectGroup>((initial?.subject_group as SubjectGroup) || defaultGroup || "xingce");
  const [tag, setTag] = useState(initial?.subject_tag || "");
  const [startLocal, setStartLocal] = useState(toLocalInput(initial?.start_time));
  const [endLocal, setEndLocal] = useState(toLocalInput(initial?.end_time));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const tags = tagsForGroup(group);
    if (tag && !tags.includes(tag)) setTag("");
  }, [group]);

  const handleSubmit = async () => {
    if (!title.trim() || !planDate) return;
    setSaving(true);
    try {
      await onSubmit({
        title: title.trim(),
        detail: detail.trim() || null,
        plan_date: planDate,
        subject_group: group,
        subject_tag: tag || null,
        start_time: fromLocalInput(startLocal),
        end_time: fromLocalInput(endLocal),
      });
    } finally {
      setSaving(false);
    }
  };

  const tags = tagsForGroup(group);

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>{t("标题", "Title")}</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("如：刷言语理解 20 题", "e.g. Verbal 20 Qs")} />
      </div>
      {!hideDate && (
        <div className="space-y-2">
          <Label>{t("日期", "Date")}</Label>
          <Input type="date" value={planDate} onChange={(e) => setPlanDate(e.target.value)} />
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label>{t("科目", "Subject")}</Label>
          <Select value={group} onValueChange={(v) => setGroup(v as SubjectGroup)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {SUBJECT_GROUPS.map((g) => (
                <SelectItem key={g} value={g}>{SUBJECT_GROUP_LABELS[g].zh}</SelectItem>
              ))}
              <SelectItem value="general">{SUBJECT_GROUP_LABELS.general.zh}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t("细分", "Tag")}</Label>
          <Select value={tag || "__none"} onValueChange={(v) => setTag(v === "__none" ? "" : v)}>
            <SelectTrigger><SelectValue placeholder={t("可选", "Optional")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">{t("无", "None")}</SelectItem>
              {tags.map((tg) => (
                <SelectItem key={tg} value={tg}>{tg}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label>{t("开始（可选）", "Start (optional)")}</Label>
          <Input type="datetime-local" value={startLocal} onChange={(e) => setStartLocal(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>{t("结束（可选）", "End (optional)")}</Label>
          <Input type="datetime-local" value={endLocal} onChange={(e) => setEndLocal(e.target.value)} />
        </div>
      </div>
      <p className="text-[11px] text-[#8a847a]">
        {t("有起止时间可同步到日程，否则同步到待办「考公」", "With time → schedule; otherwise → todos (Civil)")}
      </p>
      <div className="space-y-2">
        <Label>{t("备注", "Detail")}</Label>
        <Textarea value={detail} onChange={(e) => setDetail(e.target.value)} rows={2} />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel}>{t("取消", "Cancel")}</Button>
        )}
        <Button
          type="button"
          disabled={saving || !title.trim() || !planDate}
          onClick={handleSubmit}
          className="bg-[#d17847] hover:bg-[#c06838] text-white"
        >
          {t("保存", "Save")}
        </Button>
      </div>
    </div>
  );
}
