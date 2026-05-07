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

interface TaskModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (values: any) => void;
  projectId: string;
  initial?: any;
  defaultType?: "task" | "habit" | "milestone";
}

export function TaskModal({
  open,
  onOpenChange,
  onSave,
  projectId,
  initial,
  defaultType = "task",
}: TaskModalProps) {
  const { t, lang } = useLang();
  const [form, setForm] = useState({
    title: "",
    description: "",
    type: defaultType,
    status: "todo",
    weight: 1,
    due_date: "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        title: initial?.title || "",
        description: initial?.description || "",
        type: initial?.type || defaultType,
        status: initial?.status || "todo",
        weight: initial?.weight ?? 1,
        due_date: initial?.due_date ? initial.due_date.slice(0, 10) : "",
      });
    }
  }, [open, initial, defaultType]);

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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {initial ? t("编辑工作项","Edit Item") : t("新建工作项","New Item")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label>{t("类型","Type")}</Label>
            <Select
              value={form.type}
              onValueChange={(v: any) => setForm({ ...form, type: v })}
              disabled={!!initial}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="task">{t("任务","Task")}</SelectItem>
                <SelectItem value="habit">{t("习惯","Habit")}</SelectItem>
                <SelectItem value="milestone">{t("里程碑","Milestone")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t("标题","Title")} *</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder={isHabit ? (lang === "zh" ? "例如：晨跑 30 分钟" : "e.g. Morning run 30 min") : (lang === "zh" ? "例如：完成文献综述" : "e.g. Complete literature review")}
            />
          </div>
          <div>
            <Label>{t("描述","Description")}</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
            />
          </div>
          {!isHabit && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t("状态","Status")}</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">{t("待办","To Do")}</SelectItem>
                    <SelectItem value="this_week">{t("本周","This Week")}</SelectItem>
                    <SelectItem value="in_progress">{t("进行中","In Progress")}</SelectItem>
                    <SelectItem value="waiting">{t("等待中","Waiting")}</SelectItem>
                    <SelectItem value="done">{t("已完成","Done")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("权重","Weight")}</Label>
                <Input
                  type="number"
                  min={0.1}
                  step={0.1}
                  value={form.weight}
                  onChange={(e) => setForm({ ...form, weight: Number(e.target.value) })}
                />
              </div>
            </div>
          )}
          {isHabit && (
            <div>
              <Label>{t("权重","Weight")}</Label>
              <Input
                type="number"
                min={0}
                step={0.1}
                value={form.weight}
                onChange={(e) => setForm({ ...form, weight: Number(e.target.value) })}
                disabled
              />
              <p className="text-xs text-muted-foreground mt-1">{t("习惯默认不计入项目进度","Habits don't count toward project progress")}</p>
            </div>
          )}
          <div>
            <Label>{t("截止日期","Due Date")}</Label>
            <Input
              type="date"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            />
          </div>
          <Button onClick={handleSave} className="w-full">
            {initial ? t("保存修改","Save") : t("创建工作项","Create Item")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
