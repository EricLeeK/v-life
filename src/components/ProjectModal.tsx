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

interface ProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (values: any) => void;
  initial?: any;
}

export function ProjectModal({ open, onOpenChange, onSave, initial }: ProjectModalProps) {
  const { t } = useLang();
  const [form, setForm] = useState({
    name: "",
    description: "",
    status: "planning",
    priority: "medium",
    target_date: "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        name: initial?.name || "",
        description: initial?.description || "",
        status: initial?.status || "planning",
        priority: initial?.priority || "medium",
        target_date: initial?.target_date ? initial.target_date.slice(0, 10) : "",
      });
    }
  }, [open, initial]);

  const handleSave = () => {
    if (!form.name.trim()) return;
    onSave({
      ...form,
      target_date: form.target_date || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{initial ? t("编辑项目","Edit Project") : t("新建项目","New Project")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label>{t("项目名称","Project Name")} *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t("例如：毕业论文","e.g. Thesis")}
            />
          </div>
          <div>
            <Label>{t("项目描述","Description")}</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder={t("简要描述项目目标...","Brief project description...")}
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>{t("状态","Status")}</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planning">{t("规划中","Planning")}</SelectItem>
                  <SelectItem value="active">{t("进行中","Active")}</SelectItem>
                  <SelectItem value="paused">{t("暂停中","Paused")}</SelectItem>
                  <SelectItem value="completed">{t("已完成","Completed")}</SelectItem>
                  <SelectItem value="archived">{t("已归档","Archived")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("优先级","Priority")}</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">{t("高","High")}</SelectItem>
                  <SelectItem value="medium">{t("中","Medium")}</SelectItem>
                  <SelectItem value="low">{t("低","Low")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>{t("目标日期","Target Date")}</Label>
            <Input
              type="date"
              value={form.target_date}
              onChange={(e) => setForm({ ...form, target_date: e.target.value })}
            />
          </div>
          <Button onClick={handleSave} className="w-full">
            {initial ? t("保存修改","Save") : t("创建项目","Create Project")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
