import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Archive, Pencil, CornerDownRight } from "lucide-react";
import { todoHooks } from "@/hooks/useData";
import { useToast } from "@/hooks/use-toast";
import { useLang } from "@/contexts/LanguageContext";

const IMPORTANCE_LEVELS = [
  { key: "紧急", color: "bg-rose-50 text-rose-700 border-rose-200" },
  { key: "重要", color: "bg-amber-50 text-amber-700 border-amber-200" },
  { key: "普通", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { key: "低优先", color: "bg-slate-50 text-slate-600 border-slate-200" },
] as const;

const IMPORTANCE_LABELS: Record<string, string> = {
  "紧急": "Urgent", "重要": "Important", "普通": "Normal", "低优先": "Low",
};

type ViewMode = "category" | "importance" | "all";

export default function TodosPage() {
  const { t, lang } = useLang();
  const [viewMode, setViewMode] = useState<ViewMode>("category");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [form, setForm] = useState({ title: "", detail: "", importance: "普通", category: "生活" });
  const [editingTodo, setEditingTodo] = useState<any>(null);
  const [editForm, setEditForm] = useState({ title: "", detail: "", importance: "普通", category: "生活" });
  const [subtaskTitles, setSubtaskTitles] = useState<Record<string, string>>({});
  
  const [hideCompleted, setHideCompleted] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const { toast } = useToast();

  const { data: todos = [] } = todoHooks.useList();
  const createMutation = todoHooks.useCreate();
  const updateMutation = todoHooks.useUpdate();
  const deleteMutation = todoHooks.useDelete();

  // Separate parent and child tasks
  const parentTodos = todos.filter((t: any) => !t.parent_id);
  const childTodos = todos.filter((t: any) => t.parent_id);

  // Filter based on archived / completed states of parents
  const nonArchivedParents = parentTodos.filter((t: any) => !t.is_archived);
  const archivedParents = parentTodos.filter((t: any) => t.is_archived);
  const baseParents = showArchived ? [...nonArchivedParents, ...archivedParents] : nonArchivedParents;
  const filteredParents = hideCompleted ? baseParents.filter((t: any) => !t.is_completed) : baseParents;

  // Sort parents
  const importanceOrder: Record<string, number> = { "紧急": 0, "重要": 1, "普通": 2, "低优先": 3 };
  const sortedParents = [...filteredParents].sort((a: any, b: any) => {
    if (a.is_archived !== b.is_archived) return a.is_archived ? 1 : -1;
    if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1;
    return (importanceOrder[a.importance] ?? 2) - (importanceOrder[b.importance] ?? 2);
  });

  const hasCompletedNonArchived = nonArchivedParents.some((t: any) => t.is_completed);
  
  const handleArchiveAllCompleted = () => {
    nonArchivedParents.filter((t: any) => t.is_completed).forEach((t: any) => {
      updateMutation.mutate({ id: t.id, is_archived: true });
    });
  };

  const grouped = viewMode === "category"
    ? sortedParents.reduce((acc: Record<string, any[]>, t: any) => { (acc[t.category || "生活"] = acc[t.category || "生活"] || []).push(t); return acc; }, {})
    : viewMode === "importance"
    ? sortedParents.reduce((acc: Record<string, any[]>, t: any) => { (acc[t.importance || "普通"] = acc[t.importance || "普通"] || []).push(t); return acc; }, {})
    : { "全部": sortedParents };

  const handleSave = async () => {
    if (!form.title) { toast({ title: t("请填写标题", "Please fill title"), variant: "destructive" }); return; }
    try {
      await createMutation.mutateAsync({ title: form.title, detail: form.detail || null, importance: form.importance, category: form.category || "生活" });
      setDialogOpen(false); 
      setForm({ title: "", detail: "", importance: "普通", category: "生活" });
    } catch (e: any) { toast({ title: t("保存失败", "Save failed"), description: e.message, variant: "destructive" }); }
  };

  const handleOpenEdit = (item: any) => {
    setEditingTodo(item);
    setEditForm({
      title: item.title,
      detail: item.detail || "",
      importance: item.importance || "普通",
      category: item.category || "生活",
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editForm.title || !editingTodo) { toast({ title: t("请填写标题", "Please fill title"), variant: "destructive" }); return; }
    try {
      await updateMutation.mutateAsync({
        id: editingTodo.id,
        title: editForm.title,
        detail: editForm.detail || null,
        importance: editForm.importance,
        category: editForm.category,
      });
      setEditDialogOpen(false);
      setEditingTodo(null);
      toast({ title: t("修改成功", "Updated successfully") });
    } catch (e: any) { toast({ title: t("保存失败", "Save failed"), description: e.message, variant: "destructive" }); }
  };

  const toggleComplete = (item: any) => {
    updateMutation.mutate({ id: item.id, is_completed: !item.is_completed });
  };

  const handleAddSubtask = async (parentId: string, parentCategory: string, parentImportance: string) => {
    const title = subtaskTitles[parentId]?.trim();
    if (!title) return;

    try {
      await createMutation.mutateAsync({
        title,
        parent_id: parentId,
        category: parentCategory,
        importance: parentImportance,
        is_completed: false,
        is_archived: false,
      });
      setSubtaskTitles({ ...subtaskTitles, [parentId]: "" });
      toast({ title: t("子任务已添加", "Subtask added") });
    } catch (e: any) {
      toast({ title: t("添加子任务失败", "Add subtask failed"), description: e.message, variant: "destructive" });
    }
  };

  const TodoItem = ({ item }: { item: any }) => {
    const imp = IMPORTANCE_LEVELS.find((l) => l.key === item.importance);
    const itemSubtasks = childTodos.filter((t: any) => t.parent_id === item.id);
    const subtaskTitleVal = subtaskTitles[item.id] || "";

    return (
      <div className="space-y-1.5 mb-2">
        <Card className={`transition-colors shadow-sm border border-[#e4e1d7] ${item.is_completed ? "opacity-60 bg-[#faf9f4]" : "hover:border-[#5b88b5]/40 bg-white"}`}>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <Checkbox checked={item.is_completed} onCheckedChange={() => toggleComplete(item)} />
              <div className="flex-1 min-w-0">
                <span className={`text-sm font-medium ${item.is_completed ? "line-through text-muted-foreground" : "text-[#1f1a14]"}`}>
                  {item.title}
                </span>
                {item.detail && <p className="text-xs text-muted-foreground mt-0.5">{item.detail}</p>}
              </div>
              
              <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                <Badge variant="outline" className={`text-xs px-2 py-0.5 rounded-md font-medium border ${imp?.color || "bg-slate-50"}`}>
                  {IMPORTANCE_LABELS[item.importance] || item.importance}
                </Badge>
                
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => handleOpenEdit(item)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>

                {item.is_completed && !item.is_archived && (
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => updateMutation.mutate({ id: item.id, is_archived: true })}>
                    <Archive className="h-3.5 w-3.5" />
                  </Button>
                )}
                
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-rose-600 hover:bg-rose-50" onClick={() => deleteMutation.mutate(item.id)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Subtasks Section */}
        <div className="pl-6 border-l border-[#e4e1d7]/60 ml-3 space-y-1.5 pt-0.5 pb-2">
          {itemSubtasks.map((sub: any) => {
            const subImp = IMPORTANCE_LEVELS.find((l) => l.key === sub.importance);
            return (
              <div key={sub.id} className={`flex items-center gap-2 p-2 rounded-lg border border-[#e4e1d7]/40 bg-stone-50/50 hover:bg-stone-50 transition-colors ${sub.is_completed ? "opacity-60" : ""}`}>
                <CornerDownRight className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0" />
                <Checkbox checked={sub.is_completed} onCheckedChange={() => toggleComplete(sub)} />
                <div className="flex-1 min-w-0">
                  <span className={`text-xs font-medium ${sub.is_completed ? "line-through text-muted-foreground" : "text-[#1f1a14]"}`}>
                    {sub.title}
                  </span>
                  {sub.detail && <p className="text-[10px] text-muted-foreground">{sub.detail}</p>}
                </div>
                
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => handleOpenEdit(sub)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-rose-600" onClick={() => deleteMutation.mutate(sub.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            );
          })}

          {/* Quick Add Subtask Inline Form */}
          <div className="flex items-center gap-1.5 pl-5 pt-0.5">
            <Input
              value={subtaskTitleVal}
              onChange={(e) => setSubtaskTitles({ ...subtaskTitles, [item.id]: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddSubtask(item.id, item.category, item.importance);
              }}
              placeholder={t("添加子任务...", "Add subtask...")}
              className="h-7 text-xs bg-white border-[#e4e1d7] focus-visible:ring-1 focus-visible:ring-[#5b88b5]"
            />
            <Button
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={() => handleAddSubtask(item.id, item.category, item.importance)}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <AppLayout title={t("待办事项", "To-Dos")}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 bg-stone-100 p-0.5 rounded-lg border border-[#e4e1d7]/50">
            {(["category", "importance", "all"] as const).map((mode) => (
              <Button key={mode} variant={viewMode === mode ? "default" : "ghost"} size="sm"
                className="h-8 text-xs font-medium"
                onClick={() => setViewMode(mode)}>
                {mode === "category" ? t("按分类", "By Category") : mode === "importance" ? t("按重要性", "By Priority") : t("全览", "All")}
              </Button>
            ))}
          </div>
          <Button variant="secondary" size="sm" onClick={() => setHideCompleted(!hideCompleted)}>
            {hideCompleted ? t("显示已完成", "Show completed") : t("隐藏已完成", "Hide completed")}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setShowArchived(!showArchived)}>
            {showArchived ? t("隐藏已归档", "Hide archived") : t("显示已归档", "Show archived")}
          </Button>
          {hasCompletedNonArchived && (
            <Button variant="secondary" size="sm" onClick={handleArchiveAllCompleted}>
              <Archive className="h-3.5 w-3.5 mr-1" />{t("归档已完成", "Archive completed")}
            </Button>
          )}
          <div className="flex-1" />
          
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1" />{t("添加主任务", "Add To-Do")}
          </Button>
          
          {/* Create Dialog */}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>{t("添加待办任务", "Add To-Do Task")}</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-2">
                <div>
                  <Label className="text-xs font-medium text-foreground">{t("任务标题", "Task Title")} *</Label>
                  <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs font-medium text-foreground">{t("详细说明", "Details")}</Label>
                  <Input value={form.detail} onChange={(e) => setForm({ ...form, detail: e.target.value })} className="mt-1" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-medium text-foreground">{t("重要性", "Priority")}</Label>
                    <Select value={form.importance} onValueChange={(v) => setForm({ ...form, importance: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {IMPORTANCE_LEVELS.map((l) => <SelectItem key={l.key} value={l.key}>{IMPORTANCE_LABELS[l.key] || l.key}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-foreground">{t("分类", "Category")}</Label>
                    <Input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="生活" className="mt-1" />
                  </div>
                </div>
                <Button onClick={handleSave} className="w-full mt-2">{t("添加", "Add")}</Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Edit Dialog */}
          <Dialog open={editDialogOpen} onOpenChange={(o) => { setEditDialogOpen(o); if (!o) setEditingTodo(null); }}>
            <DialogContent className="max-w-md">
              <DialogHeader><DialogTitle>{t("编辑待办任务", "Edit To-Do Task")}</DialogTitle></DialogHeader>
              <div className="space-y-4 mt-2">
                <div>
                  <Label className="text-xs font-medium text-foreground">{t("任务标题", "Task Title")} *</Label>
                  <Input value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs font-medium text-foreground">{t("详细说明", "Details")}</Label>
                  <Input value={editForm.detail} onChange={(e) => setEditForm({ ...editForm, detail: e.target.value })} className="mt-1" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs font-medium text-foreground">{t("重要性", "Priority")}</Label>
                    <Select value={editForm.importance} onValueChange={(v) => setEditForm({ ...editForm, importance: v })}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {IMPORTANCE_LEVELS.map((l) => <SelectItem key={l.key} value={l.key}>{IMPORTANCE_LABELS[l.key] || l.key}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs font-medium text-foreground">{t("分类", "Category")}</Label>
                    <Input value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} className="mt-1" />
                  </div>
                </div>
                <Button onClick={handleSaveEdit} className="w-full mt-2">{t("保存修改", "Save Changes")}</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {Object.keys(grouped).length === 0 ? (
          <p className="text-muted-foreground text-sm py-12 text-center">{t("暂无待办事项", "No to-dos")}</p>
        ) : (
          Object.entries(grouped).map(([group, items]) => (
            <div key={group} className="space-y-2">
              {viewMode !== "all" && (
                <h3 className="text-xs font-semibold tracking-wider text-muted-foreground uppercase pt-2 px-1">
                  {group}
                </h3>
              )}
              <div className="space-y-1">
                {(items as any[]).map((item) => <TodoItem key={item.id} item={item} />)}
              </div>
            </div>
          ))
        )}
      </div>
    </AppLayout>
  );
}

