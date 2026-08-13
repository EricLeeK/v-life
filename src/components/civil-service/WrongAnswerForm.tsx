import { useState, useRef, useCallback } from "react";
import { format } from "date-fns";
import { useLang } from "@/contexts/LanguageContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  SUBJECT_GROUP_LABELS,
  SUBJECT_GROUPS,
  tagsForGroup,
  type SubjectGroup,
} from "@/lib/civilServiceSubjects";
import type { CivilWrongAnswer } from "@/hooks/useCivilService";
import { uploadCivilWrongImage } from "@/hooks/useCivilService";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { messageFromAiInvoke } from "@/lib/aiErrors";
import { useClipboardImagePaste } from "@/hooks/useClipboardImagePaste";
import type { WrongOption } from "./WrongAnswerCard";
import { Camera, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";

export type WrongAnswerFormValues = {
  title: string;
  content: string | null;
  wrong_reason: string | null;
  knowledge_point: string | null;
  subject_group: string;
  subject_tag: string | null;
  source_date: string;
  review_status: string;
  image_url: string | null;
  question_type: string | null;
  options: WrongOption[] | null;
  correct_answer: string | null;
  user_answer: string | null;
  image_required: boolean;
  ai_draft_meta?: Record<string, unknown> | null;
};

function parseOptionsFromItem(raw: CivilWrongAnswer["options"]): WrongOption[] {
  if (!raw || !Array.isArray(raw)) return [];
  return raw
    .filter((o): o is WrongOption => typeof o === "object" && o !== null && "key" in o && "text" in o)
    .map((o) => ({ key: String(o.key), text: String(o.text) }));
}

export function WrongAnswerForm({
  initial,
  defaultGroup,
  onSubmit,
  onCancel,
}: {
  initial?: CivilWrongAnswer;
  defaultGroup?: SubjectGroup;
  onSubmit: (values: WrongAnswerFormValues) => void | Promise<void>;
  onCancel?: () => void;
}) {
  const { t } = useLang();
  const { user } = useAuth();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [title, setTitle] = useState(initial?.title || "");
  const [content, setContent] = useState(initial?.content || "");
  const [wrongReason, setWrongReason] = useState(initial?.wrong_reason || "");
  const [knowledgePoint, setKnowledgePoint] = useState(initial?.knowledge_point || "");
  const [group, setGroup] = useState<SubjectGroup>((initial?.subject_group as SubjectGroup) || defaultGroup || "xingce");
  const [tag, setTag] = useState(initial?.subject_tag || "");
  const [sourceDate, setSourceDate] = useState(initial?.source_date || format(new Date(), "yyyy-MM-dd"));
  const [reviewStatus, setReviewStatus] = useState(initial?.review_status || "pending");
  const [imageUrl, setImageUrl] = useState(initial?.image_url || "");
  const [questionType, setQuestionType] = useState<string>(initial?.question_type || "");
  const [options, setOptions] = useState<WrongOption[]>(parseOptionsFromItem(initial?.options));
  const [correctAnswer, setCorrectAnswer] = useState(initial?.correct_answer || "");
  const [userAnswer, setUserAnswer] = useState(initial?.user_answer || "");
  const [imageRequired, setImageRequired] = useState(initial?.image_required ?? false);
  const [aiMeta, setAiMeta] = useState<Record<string, unknown> | null>((initial?.ai_draft_meta as any) || null);
  const [uploading, setUploading] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);

  const tags = tagsForGroup(group);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      const reader = new FileReader();
      const dataUrl: string = await new Promise((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      setPreviewDataUrl(dataUrl);

      if (user?.id) {
        const url = await uploadCivilWrongImage(user.id, file);
        setImageUrl(url);
      } else {
        setImageUrl(dataUrl);
      }
    } catch (e: any) {
      toast({ title: t("上传失败", "Upload failed"), description: e?.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handlePasteFiles = useCallback(
    (files: File[]) => {
      if (files[0]) handleFile(files[0]);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.id],
  );
  const handlePaste = useClipboardImagePaste(handlePasteFiles);

  const applyAiDraft = (d: Record<string, any>) => {
    if (d.title) setTitle(d.title);
    if (d.content) setContent(d.content);
    if (d.wrong_reason) setWrongReason(d.wrong_reason);
    if (d.knowledge_point) setKnowledgePoint(d.knowledge_point);
    if (d.subject_group && ["xingce", "shenlun", "mianshi", "general"].includes(d.subject_group)) {
      setGroup(d.subject_group);
    }
    if (d.subject_tag) setTag(d.subject_tag);
    if (d.question_type) setQuestionType(d.question_type);
    if (Array.isArray(d.options)) {
      setOptions(
        d.options
          .filter((o: any) => o?.key && o?.text)
          .map((o: any) => ({ key: String(o.key), text: String(o.text) })),
      );
    }
    if (d.correct_answer) setCorrectAnswer(String(d.correct_answer));
    if (d.user_answer) setUserAnswer(String(d.user_answer));
    if (typeof d.image_required === "boolean") setImageRequired(d.image_required);
  };

  const handleAiDraft = async () => {
    const img = previewDataUrl || imageUrl;
    if (!img) {
      toast({ title: t("请先拍照或选图", "Add a photo first"), variant: "destructive" });
      return;
    }
    setAiLoading(true);
    try {
      const prompt =
        `请识别这张考公错题图片，用一条 civil_wrong create 操作返回草稿（不要假设已保存）。` +
        `data 需含：title, content（题干，可含 LaTeX 公式如 $x^2$）, wrong_reason, knowledge_point, ` +
        `subject_group(xingce|shenlun|mianshi), subject_tag, ` +
        `question_type(choice|judgement|text), ` +
        `options（数组 [{key:"A", text:"..."}]，文字题留空数组）, ` +
        `correct_answer（如 A / AB / 对 / 自由文本）, user_answer（用户当时选的，若可识别）, ` +
        `image_required（boolean：图形推理/带图数量题等必须看图的给 true；纯文字给 false）。` +
        `subject_tag 尽量用：言语理解/资料分析/图形推理/定义类比/逻辑推理/数量关系/时政常识/综应/申论/理论学习/素材积累/热点剖析/套卷。`;

      const { data, error } = await supabase.functions.invoke("ai-chat", {
        body: {
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: img } },
              ],
            },
          ],
        },
      });
      const invokeMsg = await messageFromAiInvoke(data, error);
      if (invokeMsg) throw new Error(invokeMsg);

      const ops = data?.result?.operations || [];
      const draftOp = ops.find((o: any) => o.module === "civil_wrong" && o.action === "create") || ops[0];
      const d = draftOp?.data || {};
      applyAiDraft(d);
      setAiMeta({ raw: d, summary: data?.result?.summary });
      toast({ title: t("已填入 AI 草稿，请确认后保存", "AI draft filled — confirm then save") });
    } catch (e: any) {
      toast({ title: t("AI 识别失败", "AI failed"), description: e?.message, variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSubmit({
        title: title.trim(),
        content: content.trim() || null,
        wrong_reason: wrongReason.trim() || null,
        knowledge_point: knowledgePoint.trim() || null,
        subject_group: group,
        subject_tag: tag || null,
        source_date: sourceDate,
        review_status: reviewStatus,
        image_url: imageUrl || null,
        question_type: questionType || null,
        options: options.length ? options : null,
        correct_answer: correctAnswer.trim() || null,
        user_answer: userAnswer.trim() || null,
        image_required: imageRequired,
        ai_draft_meta: aiMeta,
      });
    } finally {
      setSaving(false);
    }
  };

  const addOption = () => {
    const keys = ["A", "B", "C", "D", "E", "F"];
    const used = new Set(options.map((o) => o.key));
    const nextKey = keys.find((k) => !used.has(k)) || String(options.length + 1);
    setOptions([...options, { key: nextKey, text: "" }]);
  };

  return (
    <div className="space-y-3" onPaste={handlePaste}>
      <div className="space-y-2">
        <Label htmlFor="wrong-photo-input">{t("拍照 / 图片", "Photo")}</Label>
        <div className="flex flex-wrap gap-2">
          <input
            id="wrong-photo-input"
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
          />
          <Button type="button" variant="outline" size="sm" className="border-border" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Camera className="h-3.5 w-3.5 mr-1" />}
            {t("选图", "Pick")}
          </Button>
          <Button type="button" variant="outline" size="sm" className="border-border" onClick={handleAiDraft} disabled={aiLoading || (!imageUrl && !previewDataUrl)}>
            {aiLoading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
            {t("AI 识图填草稿", "AI draft")}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">{t("支持 Ctrl+V 粘贴图片", "Ctrl+V to paste image")}</p>
        {(previewDataUrl || imageUrl) && (
          <img src={previewDataUrl || imageUrl} alt="" className="mt-2 max-h-40 rounded-md border border-border object-contain" />
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="wrong-title">{t("标题", "Title")}</Label>
        <Input id="wrong-title" value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="wrong-content">{t("题干 / 摘录", "Content")}</Label>
        <Textarea id="wrong-content" value={content} onChange={(e) => setContent(e.target.value)} rows={3} placeholder={t("支持 LaTeX，如 $\\frac{a}{b}$", "LaTeX supported, e.g. $\\frac{a}{b}$")} />
      </div>

      <div className="rounded-lg border border-border p-3 space-y-3">
        <p className="text-[13px] font-medium text-foreground">{t("题型与选项", "Question type & options")}</p>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <Label htmlFor="wrong-type">{t("题型", "Type")}</Label>
            <Select value={questionType || "__none"} onValueChange={(v) => setQuestionType(v === "__none" ? "" : v)}>
              <SelectTrigger id="wrong-type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none">{t("未指定", "Unspecified")}</SelectItem>
                <SelectItem value="choice">{t("选择题", "Choice")}</SelectItem>
                <SelectItem value="judgement">{t("判断题", "Judgement")}</SelectItem>
                <SelectItem value="text">{t("文字题", "Text")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{t("默认展示图", "Show image inline")}</Label>
            <div className="flex items-center gap-2 h-9">
              <Switch checked={imageRequired} onCheckedChange={setImageRequired} />
              <span className="text-[12px] text-muted-foreground">{imageRequired ? t("是", "Yes") : t("否", "No")}</span>
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-2">
            <Label htmlFor="wrong-correct-ans">{t("正确答案", "Correct answer")}</Label>
            <Input id="wrong-correct-ans" value={correctAnswer} onChange={(e) => setCorrectAnswer(e.target.value)} placeholder="A / AB / 对" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="wrong-user-ans">{t("你的选择", "Your answer")}</Label>
            <Input id="wrong-user-ans" value={userAnswer} onChange={(e) => setUserAnswer(e.target.value)} />
          </div>
        </div>
        {(questionType === "choice" || options.length > 0) && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t("选项", "Options")}</Label>
              <Button type="button" variant="ghost" size="sm" className="h-7 text-[12px]" onClick={addOption}>
                <Plus className="h-3 w-3 mr-1" />
                {t("添加", "Add")}
              </Button>
            </div>
            {options.map((opt, idx) => (
              <div key={idx} className="flex gap-2 items-start">
                <Input
                  className="w-12 shrink-0"
                  value={opt.key}
                  onChange={(e) => {
                    const next = [...options];
                    next[idx] = { ...next[idx], key: e.target.value };
                    setOptions(next);
                  }}
                />
                <Input
                  className="flex-1"
                  value={opt.text}
                  placeholder={t("选项内容", "Option text")}
                  onChange={(e) => {
                    const next = [...options];
                    next[idx] = { ...next[idx], text: e.target.value };
                    setOptions(next);
                  }}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 text-red-600"
                  onClick={() => setOptions(options.filter((_, i) => i !== idx))}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label htmlFor="wrong-subject">{t("科目", "Subject")}</Label>
          <Select value={group} onValueChange={(v) => setGroup(v as SubjectGroup)}>
            <SelectTrigger id="wrong-subject"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SUBJECT_GROUPS.map((g) => (
                <SelectItem key={g} value={g}>{SUBJECT_GROUP_LABELS[g].zh}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="wrong-tag">{t("细分", "Tag")}</Label>
          <Select value={tag || "__none"} onValueChange={(v) => setTag(v === "__none" ? "" : v)}>
            <SelectTrigger id="wrong-tag"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">{t("无", "None")}</SelectItem>
              {tags.map((tg) => (
                <SelectItem key={tg} value={tg}>{tg}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="wrong-reason">{t("错因", "Wrong reason")}</Label>
        <Textarea id="wrong-reason" value={wrongReason} onChange={(e) => setWrongReason(e.target.value)} rows={2} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="wrong-kp">{t("知识点", "Knowledge point")}</Label>
        <Input id="wrong-kp" value={knowledgePoint} onChange={(e) => setKnowledgePoint(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label htmlFor="wrong-date">{t("做错日期", "Date")}</Label>
          <Input id="wrong-date" type="date" value={sourceDate} onChange={(e) => setSourceDate(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="wrong-status">{t("状态", "Status")}</Label>
          <Select value={reviewStatus} onValueChange={setReviewStatus}>
            <SelectTrigger id="wrong-status"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">{t("待复习", "To review")}</SelectItem>
              <SelectItem value="mastered">{t("已掌握", "Mastered")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-1">
        {onCancel && <Button type="button" variant="outline" onClick={onCancel}>{t("取消", "Cancel")}</Button>}
        <Button
          type="button"
          disabled={saving || !title.trim()}
          onClick={handleSubmit}
          className="bg-[#d17847] hover:bg-[#c06838] text-white"
        >
          {t("保存", "Save")}
        </Button>
      </div>
    </div>
  );
}
