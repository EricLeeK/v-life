import { Paragraph } from "@/components/ui/typography";
import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLang } from "@/contexts/LanguageContext";
import { DateField } from "@/components/arc/DateField";
import { Check, Minus, Sparkles } from "lucide-react";
import { coverPresets } from "./projects/board-model";
import "./projects/project-board.css";
import type { Tables } from "@/integrations/supabase/types";

export type TaskFormValues = Pick<Tables<"project_tasks">, "title"|"description"|"type"|"status"|"weight"|"due_date"|"cover_preset"|"project_id">;

interface TaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (values: TaskFormValues) => void;
  projectId: string;
  initial?: Tables<"project_tasks"> | null;
  defaultType?: "task" | "habit" | "milestone";
  pending?: boolean;
  defaultStatus?: string;
}

export function TaskModal({
  open,
  onOpenChange,
  onSave,
  projectId,
  initial,
  defaultType = "task",
  pending = false,
  defaultStatus = "todo",
}: TaskModalProps) {
  const { t, lang } = useLang();
  const [form, setForm] = useState({
    title: "",
    description: "",
    type: defaultType as string,
    status: "todo",
    weight: 1,
    due_date: "",
    cover_preset: "auto",
  });

  useEffect(() => {
    if (open) {
      setForm({
        title: initial?.title || "",
        description: initial?.description || "",
        type: initial?.type || defaultType,
        status: initial?.status || defaultStatus,
        weight: initial?.weight ?? 1,
        due_date: initial?.due_date ? initial.due_date.slice(0, 10) : "",
        cover_preset: initial?.cover_preset || "auto",
      });
    }
  }, [open, initial, defaultType, defaultStatus]);

  const handleSave = () => {
    if (!form.title.trim()) return;
    onSave({
      ...form,
      project_id: projectId,
      weight: Number(form.weight) || 1,
      due_date: form.due_date || null,
    });
  };

  const isHabit = form.type === "habit";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border max-h-[90svh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground font-display">
            {initial ? t("编辑工作项", "Edit Item") : t("新建工作项", "New Item")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label htmlFor="task-type" className="text-foreground text-sm">{t("类型", "Type")}</Label>
            <Select
              value={form.type}
              onValueChange={(v) => setForm({ ...form, type: v })}
              disabled={!!initial}
            >
              <SelectTrigger id="task-type" className="border-border text-foreground">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="task">{t("任务", "Task")}</SelectItem>
                <SelectItem value="habit">{t("习惯", "Habit")}</SelectItem>
                <SelectItem value="milestone">{t("里程碑", "Milestone")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="task-title" className="text-foreground text-sm">{t("标题", "Title")} *</Label>
            <Input
              id="task-title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder={isHabit ? (lang === "zh" ? "例如：晨跑 30 分钟" : "e.g. Morning run 30 min") : (lang === "zh" ? "例如：完成文献综述" : "e.g. Complete literature review")}
              className="border-border text-foreground"
            />
          </div>
          <div>
            <Label htmlFor="task-desc" className="text-foreground text-sm">{t("描述", "Description")}</Label>
            <Textarea
              id="task-desc"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="border-border text-foreground"
            />
          </div>
          {!isHabit && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="task-status" className="text-foreground text-sm">{t("状态", "Status")}</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: v })}
                >
                  <SelectTrigger id="task-status" className="border-border text-foreground">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">{t("待办", "To Do")}</SelectItem>
                    <SelectItem value="this_week">{t("本周", "This Week")}</SelectItem>
                    <SelectItem value="in_progress">{t("进行中", "In Progress")}</SelectItem>
                    <SelectItem value="waiting">{t("等待中", "Waiting")}</SelectItem>
                    <SelectItem value="done">{t("已完成", "Done")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="task-weight" className="text-foreground text-sm">{t("权重", "Weight")}</Label>
                <Input
                  id="task-weight"
                  type="number"
                  min={0.1}
                  step={0.1}
                  value={form.weight}
                  onChange={(e) => setForm({ ...form, weight: Number(e.target.value) })}
                  className="border-border text-foreground"
                />
              </div>
            </div>
          )}
          {isHabit && (
            <div>
              <Label htmlFor="task-habit-weight" className="text-foreground text-sm">{t("权重", "Weight")}</Label>
              <Input
                id="task-habit-weight"
                type="number"
                min={0}
                step={0.1}
                value={form.weight}
                onChange={(e) => setForm({ ...form, weight: Number(e.target.value) })}
                disabled
                className="border-border text-foreground"
              />
              <Paragraph className="text-xs text-muted-foreground mt-1">{t("习惯默认不计入项目进度", "Habits don't count toward project progress")}</Paragraph>
            </div>
          )}
          <div>
            <Label htmlFor="task-due-date" className="text-foreground text-sm">{t("截止日期", "Due Date")}</Label>
            <DateField
              id="task-due-date"
              label={t("截止日期", "Due Date")}
              value={form.due_date}
              onChange={(due_date) => setForm({ ...form, due_date })}
            />
          </div>
          <fieldset>
            <legend className="text-sm font-medium mb-2">{t("卡片纹理", "Card texture")}</legend>
            <p className="text-xs text-muted-foreground mb-3">{t("选择彩色纹理后，卡片会显示封面与“重点事项”标记；习惯和里程碑保留各自标记，不改变优先级或进度权重。", "A colored texture adds a cover and a Focus item label. Habits and milestones keep their own labels; priority and progress weight stay unchanged.")}</p>
            <div className="project-cover-picker">
              {coverPresets.map(preset => <button key={preset.id} type="button" className="project-cover-option" aria-pressed={form.cover_preset === preset.id} aria-label={t(preset.zh, preset.en)} onClick={() => setForm({ ...form, cover_preset: preset.id })}>
                {preset.id === "auto" || preset.id === "none" ? <span className="cover-empty">{preset.id === "auto" ? <Sparkles className="h-4 w-4" /> : <Minus className="h-4 w-4" />}</span> : <div className="project-cover" data-preset={preset.id} />}
                <span className="project-cover-option-label">{t(preset.zh, preset.en)}</span>
                <span className="project-cover-mini-content" aria-hidden="true">
                  <span className="project-cover-mini-line" />
                  <span className="project-cover-mini-meta"><span /><span /></span>
                  <Check className="project-cover-mini-check" />
                </span>
              </button>)}
            </div>
            <Paragraph className="text-[11px] text-muted-foreground mt-2">{t("自动：里程碑使用鼠尾草纹理，其他事项保持简洁。", "Auto: sage for milestones; other items stay plain.")}</Paragraph>
          </fieldset>
          <Button disabled={pending || !form.title.trim()} onClick={handleSave} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
            {pending ? t("保存中…", "Saving…") : initial ? t("保存修改", "Save") : t("创建工作项", "Create Item")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
