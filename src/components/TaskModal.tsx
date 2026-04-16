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
            {initial ? "编辑工作项" : "新建工作项"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label>类型</Label>
            <Select
              value={form.type}
              onValueChange={(v: any) => setForm({ ...form, type: v })}
              disabled={!!initial}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="task">任务</SelectItem>
                <SelectItem value="habit">习惯</SelectItem>
                <SelectItem value="milestone">里程碑</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>标题 *</Label>
            <Input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder={isHabit ? "例如：晨跑 30 分钟" : "例如：完成文献综述"}
            />
          </div>
          <div>
            <Label>描述</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
            />
          </div>
          {!isHabit && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>状态</Label>
                <Select
                  value={form.status}
                  onValueChange={(v) => setForm({ ...form, status: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">待办</SelectItem>
                    <SelectItem value="this_week">本周</SelectItem>
                    <SelectItem value="in_progress">进行中</SelectItem>
                    <SelectItem value="waiting">等待中</SelectItem>
                    <SelectItem value="done">已完成</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>权重</Label>
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
              <Label>权重</Label>
              <Input
                type="number"
                min={0}
                step={0.1}
                value={form.weight}
                onChange={(e) => setForm({ ...form, weight: Number(e.target.value) })}
                disabled
              />
              <p className="text-xs text-muted-foreground mt-1">习惯默认不计入项目进度</p>
            </div>
          )}
          <div>
            <Label>截止日期</Label>
            <Input
              type="date"
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            />
          </div>
          <Button onClick={handleSave} className="w-full">
            {initial ? "保存修改" : "创建工作项"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
