import { useState } from "react";
import { format } from "date-fns";
import { useLang } from "@/contexts/LanguageContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { XINGCE_SUBJECT_FIELDS, paperTotals, type CivilXingcePaper } from "@/lib/civilXingcePaper";

export type XingcePaperFormValues = {
  taken_date: string;
  source: string;
  is_mock: boolean;
  verbal_total: number;
  verbal_correct: number;
  data_total: number;
  data_correct: number;
  graphic_total: number;
  graphic_correct: number;
  logic_total: number;
  logic_correct: number;
  analogy_total: number;
  analogy_correct: number;
  quantity_total: number;
  quantity_correct: number;
  common_total: number;
  common_correct: number;
  duration_minutes: number | null;
  total_score: number | null;
  beat_rate: number | null;
  notes: string | null;
};

function num(v: string): number {
  const n = parseInt(v, 10);
  return Number.isNaN(n) || n < 0 ? 0 : n;
}

function optionalNum(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

export function XingcePaperForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: CivilXingcePaper;
  onSubmit: (values: XingcePaperFormValues) => void | Promise<void>;
  onCancel?: () => void;
}) {
  const { t } = useLang();
  const [takenDate, setTakenDate] = useState(initial?.taken_date || format(new Date(), "yyyy-MM-dd"));
  const [source, setSource] = useState(initial?.source || "");
  const [isMock, setIsMock] = useState(initial?.is_mock ?? true);
  const [scores, setScores] = useState(() => {
    const o: Record<string, { total: string; correct: string }> = {};
    for (const f of XINGCE_SUBJECT_FIELDS) {
      o[f.key] = {
        total: String(initial?.[f.total] ?? 0),
        correct: String(initial?.[f.correct] ?? 0),
      };
    }
    return o;
  });
  const [duration, setDuration] = useState(initial?.duration_minutes != null ? String(initial.duration_minutes) : "");
  const [totalScore, setTotalScore] = useState(initial?.total_score != null ? String(initial.total_score) : "");
  const [beatRate, setBeatRate] = useState(initial?.beat_rate != null ? String(initial.beat_rate) : "");
  const [notes, setNotes] = useState(initial?.notes || "");
  const [saving, setSaving] = useState(false);

  const preview = paperTotals({
    verbal_total: num(scores.verbal.total),
    verbal_correct: num(scores.verbal.correct),
    data_total: num(scores.data.total),
    data_correct: num(scores.data.correct),
    graphic_total: num(scores.graphic.total),
    graphic_correct: num(scores.graphic.correct),
    logic_total: num(scores.logic.total),
    logic_correct: num(scores.logic.correct),
    analogy_total: num(scores.analogy.total),
    analogy_correct: num(scores.analogy.correct),
    quantity_total: num(scores.quantity.total),
    quantity_correct: num(scores.quantity.correct),
    common_total: num(scores.common.total),
    common_correct: num(scores.common.correct),
  });

  const handleSubmit = async () => {
    if (!takenDate || !source.trim()) return;
    setSaving(true);
    try {
      await onSubmit({
        taken_date: takenDate,
        source: source.trim(),
        is_mock: isMock,
        verbal_total: num(scores.verbal.total),
        verbal_correct: num(scores.verbal.correct),
        data_total: num(scores.data.total),
        data_correct: num(scores.data.correct),
        graphic_total: num(scores.graphic.total),
        graphic_correct: num(scores.graphic.correct),
        logic_total: num(scores.logic.total),
        logic_correct: num(scores.logic.correct),
        analogy_total: num(scores.analogy.total),
        analogy_correct: num(scores.analogy.correct),
        quantity_total: num(scores.quantity.total),
        quantity_correct: num(scores.quantity.correct),
        common_total: num(scores.common.total),
        common_correct: num(scores.common.correct),
        duration_minutes: optionalNum(duration),
        total_score: optionalNum(totalScore),
        beat_rate: optionalNum(beatRate),
        notes: notes.trim() || null,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label>{t("做题日期", "Date")}</Label>
          <Input type="date" value={takenDate} onChange={(e) => setTakenDate(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>{t("套题来源", "Source")}</Label>
          <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder={t("如：粉笔模考", "e.g. Fenbi mock")} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm text-[#1f1a14]">
        <Checkbox checked={isMock} onCheckedChange={(v) => setIsMock(!!v)} />
        {t("正式模考", "Formal mock")}
      </label>

      <div className="space-y-2">
        <Label>{t("各科题量 / 正确数", "Total / Correct by subject")}</Label>
        <div className="space-y-2">
          {XINGCE_SUBJECT_FIELDS.map((f) => (
            <div key={f.key} className="grid grid-cols-[1fr_72px_72px] gap-2 items-center">
              <span className="text-[13px] text-[#1f1a14]">{f.labelZh}</span>
              <Input
                type="number"
                min={0}
                className="font-mono-data h-8"
                placeholder={t("题量", "Total")}
                value={scores[f.key].total}
                onChange={(e) => setScores({ ...scores, [f.key]: { ...scores[f.key], total: e.target.value } })}
              />
              <Input
                type="number"
                min={0}
                className="font-mono-data h-8"
                placeholder={t("正确", "OK")}
                value={scores[f.key].correct}
                onChange={(e) => setScores({ ...scores, [f.key]: { ...scores[f.key], correct: e.target.value } })}
              />
            </div>
          ))}
        </div>
        <p className="text-[12px] text-[#8a847a] font-mono-data">
          {t("总正确率", "Overall")}: {preview.overallRate != null ? `${preview.overallRate}%` : "—"}
          {" · "}
          {t("判断", "Judgment")}: {preview.judgmentRate != null ? `${preview.judgmentRate}%` : "—"}
          {" · "}
          {preview.correct}/{preview.total}
        </p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-2">
          <Label>{t("用时(分)", "Minutes")}</Label>
          <Input type="number" min={0} className="font-mono-data" value={duration} onChange={(e) => setDuration(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>{t("总分", "Score")}</Label>
          <Input type="number" className="font-mono-data" value={totalScore} onChange={(e) => setTotalScore(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>{t("击败率%", "Beat %")}</Label>
          <Input type="number" min={0} max={100} className="font-mono-data" value={beatRate} onChange={(e) => setBeatRate(e.target.value)} />
        </div>
      </div>

      <div className="space-y-2">
        <Label>{t("错题 / 知识点备注", "Notes")}</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        {onCancel && <Button type="button" variant="outline" onClick={onCancel}>{t("取消", "Cancel")}</Button>}
        <Button
          type="button"
          disabled={saving || !takenDate || !source.trim()}
          onClick={handleSubmit}
          className="bg-[#d17847] hover:bg-[#c06838] text-white"
        >
          {t("保存", "Save")}
        </Button>
      </div>
    </div>
  );
}
