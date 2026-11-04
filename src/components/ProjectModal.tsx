import { CategoryInput } from "./TaskCategoryInput";
import { taskCategories } from "@/lib/taskCategories";
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

import { ProjectIcon } from "./projects/ProjectIcon";
import { Check, ChevronDown, Minus, Sparkles } from "lucide-react";
import { coverPresets, projectCoverAccent } from "./projects/board-model";
import "./projects/project-board.css";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { projectIconPresets, iconSvg } from "./projects/project-icons";

interface ProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (values: any) => void;
  initial?: any;
  pending?: boolean;
  categories?: string[];
}

export function ProjectModal({ open, onOpenChange, onSave, initial, pending = false, categories = [] }: ProjectModalProps) {
  const { t } = useLang();
  const [iconsOpen, setIconsOpen] = useState(false);
  const [colorsOpen, setColorsOpen] = useState(false);
  const [form, setForm] = useState({
    category: "",
    name: "",
    description: "",
    status: "planning",
    priority: "medium",
    target_date: "",
    target_start_date: "",
    icon_svg: "",
    cover_preset: "auto",
  });

  useEffect(() => {
    if (open) {
      setIconsOpen(false);
      setColorsOpen(false);
      setForm({
        icon_svg: initial?.icon_svg || "",
        cover_preset: initial?.cover_preset || "auto",
        category: initial?.category || "",
        name: initial?.name || "",
        description: initial?.description || "",
        status: initial?.status || "planning",
        priority: initial?.priority || "medium",
        target_date: initial?.target_date ? initial.target_date.slice(0, 10) : "",
        target_start_date: initial?.target_start_date?.slice(0, 10) || "",
      });
    }
  }, [open, initial]);

  const handleSave = () => {
    if (!form.name.trim()) return;
    onSave({
      ...form,
      category: form.category.trim() || null,
      icon_svg: form.icon_svg || null,
      target_date: form.target_date || null,
      target_start_date: form.target_start_date || null,
    });
  };

  const selectedColor = coverPresets.find(p => p.id === form.cover_preset) || coverPresets[0];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md bg-card border-border max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-foreground font-display">
            {initial ? t("编辑项目", "Edit Project") : t("新建项目", "New Project")}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <Label htmlFor="proj-name" className="text-foreground text-sm">{t("项目名称", "Project Name")} *</Label>
            <Input
              id="proj-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder={t("例如：毕业论文", "e.g. Thesis")}
              className="border-border text-foreground"
            />
          </div>
          <div>
            <Label htmlFor="proj-category" className="text-foreground text-sm">{t("分类", "Category")}</Label>
            <CategoryInput id="proj-category" value={form.category}
              onChange={category => setForm({ ...form, category })}
              existingCategories={taskCategories(categories.map(category => ({category})), [{category:initial?.category}])}
              placeholder={t("选择或输入分类，如科研、工作、生活", "Choose or enter a category")} />
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t("项目图标", "Project icon")}</legend>
            <Collapsible open={iconsOpen} onOpenChange={setIconsOpen}>
              <CollapsibleTrigger className="project-icon-disclosure" aria-label={t("选择项目图标", "Choose project icon")}>
                <ProjectIcon name={form.name} svg={form.icon_svg} />
                <span className="flex-1 text-left text-xs text-muted-foreground">{t("选择图标 · 30 个预设", "Choose an icon · 30 presets")}</span>
                <ChevronDown className="h-3.5 w-3.5 transition-transform" style={{transform:iconsOpen ? "rotate(180deg)" : undefined}} />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <button type="button" className="project-icon-auto" aria-pressed={!form.icon_svg} onClick={() => setForm({...form, icon_svg: ""})}>{t("按项目名称自动匹配", "Match the project name automatically")}</button>
                <div className="project-icon-picker" role="group" aria-label={t("预设图标", "Preset icons")}>
                  {projectIconPresets.map(preset => <button key={preset.id} type="button" title={t(preset.zh,preset.en)} aria-label={t(preset.zh,preset.en)} aria-pressed={form.icon_svg === iconSvg(preset.id)} onClick={() => setForm({...form,icon_svg:iconSvg(preset.id)})}><ProjectIcon name="" svg={iconSvg(preset.id)}/></button>)}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </fieldset>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">{t("项目颜色", "Project color")}</legend>
            <Collapsible open={colorsOpen} onOpenChange={setColorsOpen}>
              <CollapsibleTrigger className="project-icon-disclosure" aria-label={t("选择项目颜色", "Choose project color")}>
                <span className="project-color-preview" aria-hidden="true">
                  {form.cover_preset !== "none" && <span className="project-cover" data-preset={projectCoverAccent(initial?.id || form.name, form.cover_preset)} />}
                </span>
                <span className="flex-1 text-left text-xs text-muted-foreground">{t(selectedColor.zh, selectedColor.en)}</span>
                <ChevronDown className="h-3.5 w-3.5 transition-transform" style={{transform:colorsOpen ? "rotate(180deg)" : undefined}} />
              </CollapsibleTrigger>
              <CollapsibleContent className="pt-2">
                <div className="project-cover-picker" role="group" aria-label={t("项目纹理色", "Project textures")}>
                  {coverPresets.map(preset => <button key={preset.id} type="button" className="project-cover-option" aria-pressed={form.cover_preset === preset.id} aria-label={t(preset.zh, preset.en)} onClick={() => setForm({...form, cover_preset:preset.id})}>
                    {preset.id === "auto" || preset.id === "none" ? <span className="cover-empty">{preset.id === "auto" ? <Sparkles className="h-4 w-4" /> : <Minus className="h-4 w-4" />}</span> : <span className="project-cover" data-preset={preset.id} />}
                    <span className="project-cover-option-label">{t(preset.zh, preset.en)}</span>
                    <span className="project-cover-mini-content" aria-hidden="true"><span className="project-cover-mini-line" /><span className="project-cover-mini-meta"><span /><span /></span><Check className="project-cover-mini-check" /></span>
                  </button>)}
                </div>
                <p className="mt-2 text-[11px] text-muted-foreground">{t("代办仓库中的项目卡会同步使用这个颜色。", "Project cards in the task library share this color.")}</p>
              </CollapsibleContent>
            </Collapsible>
          </fieldset>
          <div>
            <Label htmlFor="proj-desc" className="text-foreground text-sm">{t("项目描述", "Description")}</Label>
            <Textarea
              id="proj-desc"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder={t("简要描述项目目标...", "Brief project description...")}
              rows={3}
              className="border-border text-foreground"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="proj-status" className="text-foreground text-sm">{t("状态", "Status")}</Label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger id="proj-status" className="border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="planning">{t("规划中", "Planning")}</SelectItem>
                  <SelectItem value="active">{t("进行中", "Active")}</SelectItem>
                  <SelectItem value="paused">{t("暂停中", "Paused")}</SelectItem>
                  <SelectItem value="completed">{t("已完成", "Completed")}</SelectItem>
                  <SelectItem value="archived">{t("已归档", "Archived")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="proj-priority" className="text-foreground text-sm">{t("优先级", "Priority")}</Label>
              <Select value={form.priority} onValueChange={(v) => setForm({ ...form, priority: v })}>
                <SelectTrigger id="proj-priority" className="border-border text-foreground">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">{t("高", "High")}</SelectItem>
                  <SelectItem value="medium">{t("中", "Medium")}</SelectItem>
                  <SelectItem value="low">{t("低", "Low")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label htmlFor="proj-target-date" className="text-foreground text-sm">{t("目标日期", "Target Date")}</Label>
            <DateField
              id="proj-target-date"
              label={t("目标日期", "Target Date")}
              value={form.target_date}
              startValue={form.target_start_date}
              onChange={(target_date) => setForm({ ...form, target_date })}
              onRangeChange={({ start, end }) => setForm({ ...form, target_start_date: start, target_date: end })}
            />
            {form.target_date && <Button variant="ghost" size="sm" onClick={() => setForm({ ...form, target_start_date: "", target_date: "" })}>
              {t("清除目标日期", "Clear target dates")}
            </Button>}
          </div>
          <Button disabled={pending || !form.name.trim()} onClick={handleSave} className="w-full bg-primary hover:bg-primary/90 text-primary-foreground">
            {pending ? t("保存中…", "Saving…") : initial ? t("保存修改", "Save") : t("创建项目", "Create Project")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
