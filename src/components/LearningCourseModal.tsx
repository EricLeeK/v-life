import { useEffect, useState } from "react";
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
import { useLang } from "@/contexts/LanguageContext";
import type { Tables } from "@/integrations/supabase/types";

type LearningCourse = Tables<"learning_courses">;
export type LearningCourseFormValues = {
  name: string;
  description: string | null;
  color: string;
};

interface LearningCourseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (values: LearningCourseFormValues) => void;
  initial?: Partial<LearningCourse> | null;
}

export function LearningCourseModal({ open, onOpenChange, onSave, initial }: LearningCourseModalProps) {
  const { t } = useLang();
  const [form, setForm] = useState({
    name: "",
    description: "",
    color: "#5b88b5",
  });

  useEffect(() => {
    if (open) {
      setForm({
        name: initial?.name || "",
        description: initial?.description || "",
        color: initial?.color || "#5b88b5",
      });
    }
  }, [open, initial]);

  const handleSave = () => {
    if (!form.name.trim()) return;
    onSave({
      name: form.name.trim(),
      description: form.description.trim() || null,
      color: form.color || "#5b88b5",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-white border-[#e4e1d7]">
        <DialogHeader>
          <DialogTitle className="text-[#1f1a14] font-display">
            {initial ? t("编辑课程", "Edit Course") : t("新建课程", "New Course")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label className="text-[#1f1a14] text-sm">{t("课程名称", "Course Name")} *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t("例如：深度学习研讨", "e.g. Deep Learning Seminar")}
              className="border-[#e4e1d7] text-[#1f1a14]"
            />
          </div>
          <div>
            <Label className="text-[#1f1a14] text-sm">{t("课程描述", "Description")}</Label>
            <Textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder={t("简要记录课程内容、目标或资料来源...", "Briefly describe the course...")}
              rows={3}
              className="border-[#e4e1d7] text-[#1f1a14]"
            />
          </div>
          <div>
            <Label className="text-[#1f1a14] text-sm">{t("标识颜色", "Color")}</Label>
            <div className="flex items-center gap-2">
              <Input
                type="color"
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="h-10 w-14 p-1 border-[#e4e1d7]"
              />
              <Input
                value={form.color}
                onChange={(e) => setForm({ ...form, color: e.target.value })}
                className="border-[#e4e1d7] text-[#1f1a14] font-mono text-xs"
              />
            </div>
          </div>
          <Button onClick={handleSave} className="w-full bg-[#1f1a14] hover:bg-[#1f1a14]/90 text-white">
            {initial ? t("保存修改", "Save") : t("创建课程", "Create Course")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
