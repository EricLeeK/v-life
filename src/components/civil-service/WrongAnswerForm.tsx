import { useState, useRef } from "react";
import { format } from "date-fns";
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
import type { CivilWrongAnswer } from "@/hooks/useCivilService";
import { uploadCivilWrongImage } from "@/hooks/useCivilService";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { messageFromAiInvoke } from "@/lib/aiErrors";
import { Camera, Loader2, Sparkles } from "lucide-react";

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
  ai_draft_meta?: Record<string, unknown> | null;
};

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
        `data 需含：title, content, wrong_reason, knowledge_point, subject_group(xingce|shenlun|mianshi), subject_tag。` +
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
      if (d.title) setTitle(d.title);
      if (d.content) setContent(d.content);
      if (d.wrong_reason) setWrongReason(d.wrong_reason);
      if (d.knowledge_point) setKnowledgePoint(d.knowledge_point);
      if (d.subject_group && ["xingce", "shenlun", "mianshi", "general"].includes(d.subject_group)) {
        setGroup(d.subject_group);
      }
      if (d.subject_tag) setTag(d.subject_tag);
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
        ai_draft_meta: aiMeta,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>{t("拍照 / 图片", "Photo")}</Label>
        <div className="flex flex-wrap gap-2">
          <input
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
          <Button type="button" variant="outline" size="sm" className="border-[#e4e1d7]" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Camera className="h-3.5 w-3.5 mr-1" />}
            {t("选图", "Pick")}
          </Button>
          <Button type="button" variant="outline" size="sm" className="border-[#e4e1d7]" onClick={handleAiDraft} disabled={aiLoading || (!imageUrl && !previewDataUrl)}>
            {aiLoading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
            {t("AI 识图填草稿", "AI draft")}
          </Button>
        </div>
        {(previewDataUrl || imageUrl) && (
          <img src={previewDataUrl || imageUrl} alt="" className="mt-2 max-h-40 rounded-md border border-[#e4e1d7] object-contain" />
        )}
      </div>

      <div className="space-y-2">
        <Label>{t("标题", "Title")}</Label>
        <Input value={title} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>{t("题干 / 摘录", "Content")}</Label>
        <Textarea value={content} onChange={(e) => setContent(e.target.value)} rows={3} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label>{t("科目", "Subject")}</Label>
          <Select value={group} onValueChange={(v) => setGroup(v as SubjectGroup)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {SUBJECT_GROUPS.map((g) => (
                <SelectItem key={g} value={g}>{SUBJECT_GROUP_LABELS[g].zh}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>{t("细分", "Tag")}</Label>
          <Select value={tag || "__none"} onValueChange={(v) => setTag(v === "__none" ? "" : v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
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
        <Label>{t("错因", "Wrong reason")}</Label>
        <Textarea value={wrongReason} onChange={(e) => setWrongReason(e.target.value)} rows={2} />
      </div>
      <div className="space-y-2">
        <Label>{t("知识点", "Knowledge point")}</Label>
        <Input value={knowledgePoint} onChange={(e) => setKnowledgePoint(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label>{t("做错日期", "Date")}</Label>
          <Input type="date" value={sourceDate} onChange={(e) => setSourceDate(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label>{t("状态", "Status")}</Label>
          <Select value={reviewStatus} onValueChange={setReviewStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
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
