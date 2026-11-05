import { useState } from "react";
import { useLang } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TaskDurationDial } from "@/components/today/TaskDurationDial";

export interface TaskContentValues {
  title: string;
  detail: string | null;
  estimated_minutes: number;
}

export interface TaskContentItem {
  id: string;
  title: string;
  detail?: string | null;
  estimated_minutes?: number | null;
}

interface TaskContentEditorProps {
  item: TaskContentItem;
  onSave: (values: TaskContentValues) => Promise<unknown> | unknown;
  destination?: "todo" | "project";
  triggerClassName?: string;
  textClassName?: string;
}

export function TaskContentEditor({ item, onSave, destination = "todo", triggerClassName, textClassName }: TaskContentEditorProps) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState(item.title);
  const [detail, setDetail] = useState(item.detail ?? "");
  const [duration, setDuration] = useState(item.estimated_minutes ?? 30);
  const [titleError, setTitleError] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      setTitle(item.title);
      setDetail(item.detail ?? "");
      setDuration(item.estimated_minutes ?? 30);
      setTitleError(false);
      setSaveError(false);
    }
  };

  const handleSave = async () => {
    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setTitleError(true);
      return;
    }
    setSaving(true);
    try {
      await onSave({
        title: cleanTitle,
        detail: detail.trim() || null,
        estimated_minutes: duration,
      });
      setOpen(false);
      setSaveError(false);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        className={`h-auto min-w-0 justify-start whitespace-normal px-0 py-0 text-left hover:bg-transparent ${triggerClassName ?? ""}`}
        onClick={() => handleOpenChange(true)}
      >
        <span className={textClassName}>{item.title}</span>
      </Button>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{t("编辑任务", "Edit task")}</DialogTitle>
            <DialogDescription>
              {destination === "project"
                ? t("修改会同步到项目原卡。", "Changes sync to the project task card.")
                : t("修改会同步到待办仓库。", "Changes sync to your task repository.")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={`today-task-title-${item.id}`}>{t("任务标题", "Task title")}</Label>
              <Input
                id={`today-task-title-${item.id}`}
                value={title}
                onChange={(event) => { setTitle(event.target.value); setTitleError(false); }}
                aria-invalid={titleError}
                autoFocus
              />
              {titleError && <p className="text-sm text-destructive">{t("请填写任务标题", "A title is required.")}</p>}
              {saveError && <p role="alert" className="text-sm text-destructive">{t("保存失败，请重试。", "Save failed. Please try again.")}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor={`today-task-detail-${item.id}`}>{t("详情", "Details")}</Label>
              <Textarea
                id={`today-task-detail-${item.id}`}
                value={detail}
                onChange={(event) => setDetail(event.target.value)}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("预计时长", "Estimated duration")}</Label>
              <TaskDurationDial value={duration} onChange={setDuration} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>{t("取消", "Cancel")}</Button>
            <Button type="button" onClick={() => void handleSave()} disabled={saving}>{t("保存", "Save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
