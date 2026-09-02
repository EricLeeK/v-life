import { useState, useRef, useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Trash2,
  Archive,
  Pencil,
  ChevronDown,
  ChevronRight,
  MoreHorizontal,
  GripVertical,
  Check,
  AlignLeft,
  X,
  ArchiveRestore,
  Folder,
  Repeat,
} from "lucide-react";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { todoHooks } from "@/hooks/useData";
import { isPersistentKind } from "@/lib/habits";
import { useToast } from "@/hooks/use-toast";
import { useLang } from "@/contexts/LanguageContext";

const IMPORTANCE_LEVELS = [
  { key: "紧急", labelEn: "Urgent", color: "bg-cat-red-bg text-cat-red border-none font-medium" },
  { key: "重要", labelEn: "Important", color: "bg-cat-orange-bg text-cat-orange border-none font-medium" },
  { key: "普通", labelEn: "Normal", color: "bg-cat-blue-bg text-cat-blue border-none font-medium" },
  { key: "低优先", labelEn: "Low", color: "bg-muted text-muted-foreground border-none font-medium" },
] as const;

const IMPORTANCE_MAP: Record<string, { labelZh: string; labelEn: string; color: string }> = {
  "urgent": { labelZh: "紧急", labelEn: "Urgent", color: "bg-cat-red-bg text-cat-red border-none font-medium" },
  "紧急": { labelZh: "紧急", labelEn: "Urgent", color: "bg-cat-red-bg text-cat-red border-none font-medium" },
  "important": { labelZh: "重要", labelEn: "Important", color: "bg-cat-orange-bg text-cat-orange border-none font-medium" },
  "重要": { labelZh: "重要", labelEn: "Important", color: "bg-cat-orange-bg text-cat-orange border-none font-medium" },
  "normal": { labelZh: "普通", labelEn: "Normal", color: "bg-cat-blue-bg text-cat-blue border-none font-medium" },
  "普通": { labelZh: "普通", labelEn: "Normal", color: "bg-cat-blue-bg text-cat-blue border-none font-medium" },
  "low": { labelZh: "低优先", labelEn: "Low", color: "bg-muted text-muted-foreground border-none font-medium" },
  "低优先": { labelZh: "低优先", labelEn: "Low", color: "bg-muted text-muted-foreground border-none font-medium" },
};

type ViewMode = "category" | "importance" | "all";

const CategoryInput = ({ id, value, onChange, existingCategories, placeholder }: {
  id?: string;
  value: string;
  onChange: (val: string) => void;
  existingCategories: string[];
  placeholder?: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="relative mt-1">
      <div className="relative flex items-center">
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="pr-8 h-9 text-xs"
          aria-expanded={existingCategories.length > 0 ? isOpen : undefined}
          aria-haspopup={existingCategories.length > 0 ? "listbox" : undefined}
        />
        {existingCategories.length > 0 && (
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="absolute right-2 text-muted-foreground hover:text-muted-foreground focus:outline-none"
            style={{ zIndex: 5 }}
            aria-label={isOpen ? "收起分类列表" : "展开分类列表"}
            aria-expanded={isOpen}
          >
            <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>
      {isOpen && existingCategories.length > 0 && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} aria-hidden="true" />
          <div role="listbox" className="absolute left-0 right-0 mt-1 max-h-40 overflow-y-auto bg-card border border-border rounded-lg shadow-lg z-20 py-1">
            {existingCategories.map((cat: string) => (
              <button
                key={cat}
                type="button"
                role="option"
                onClick={() => {
                  onChange(cat);
                  setIsOpen(false);
                }}
                className="w-full text-left px-3 py-1.5 text-xs text-foreground hover:bg-muted/40 transition-colors"
              >
                {cat}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default function TodosPage() {
  const { t } = useLang();
  const location = useLocation();
  const openCreateFromDashboard = new URLSearchParams(location.search).get("new") === "1";
  const [viewMode, setViewMode] = useState<ViewMode>("category");
  const [dialogOpen, setDialogOpen] = useState(openCreateFromDashboard);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  
  // Forms
  const [form, setForm] = useState({ title: "", detail: "", tags: "", importance: "普通", category: "AI学习", kind: "once", habit_type: "checkin", habit_target: "", habit_unit: "" });
  const [editingTodo, setEditingTodo] = useState<any>(null);
  const [editForm, setEditForm] = useState({ title: "", detail: "", tags: "", importance: "普通", category: "AI学习", kind: "once", habit_type: "checkin", habit_target: "", habit_unit: "", is_paused: false });

  // Subtask Quick Add Inline State
  const [addingSubtaskFor, setAddingSubtaskFor] = useState<string | null>(null);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState("");

  // Subtask Note Modal State
  const [noteEditTodo, setNoteEditTodo] = useState<any>(null);
  const [noteContent, setNoteContent] = useState("");

  // Subtask Reorder Local State
  const [subtaskOrders, setSubtaskOrders] = useState<Record<string, string[]>>({});

  // Category Collapse State
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({});

  // Expanded Tasks State (default ARIS expanded)
  const [expandedTasks, setExpandedTasks] = useState<Record<string, boolean>>({
    "demo-t-ai-04": true,
  });

  // Lock element position under mouse cursor upon expand/collapse
  const pendingLockRef = useRef<{ element: HTMLElement; initialTop: number } | null>(null);

  useLayoutEffect(() => {
    if (pendingLockRef.current) {
      const { element, initialTop } = pendingLockRef.current;
      const newTop = element.getBoundingClientRect().top;
      const delta = newTop - initialTop;
      if (Math.abs(delta) > 0.5) {
        window.scrollBy(0, delta);
      }
      pendingLockRef.current = null;
    }
  }, [collapsedCategories, expandedTasks]);

  const handleCategoryToggleClick = (e: React.MouseEvent, group: string) => {
    const targetEl = e.currentTarget as HTMLElement;
    const initialTop = targetEl.getBoundingClientRect().top;
    pendingLockRef.current = {
      element: targetEl,
      initialTop,
    };
    setCollapsedCategories((prev) => ({
      ...prev,
      [group]: !prev[group],
    }));
  };

  const handleTaskToggleClick = (e: React.MouseEvent, taskId: string) => {
    const targetEl = (e.currentTarget.closest(".space-y-2") || e.currentTarget) as HTMLElement;
    if (targetEl) {
      const initialTop = targetEl.getBoundingClientRect().top;
      pendingLockRef.current = {
        element: targetEl,
        initialTop,
      };
    }
    setExpandedTasks((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
  };

  const [hideCompleted, setHideCompleted] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const { toast } = useToast();

  const { data: todos = [] } = todoHooks.useList();

  const existingCategories = Array.from(
    new Set(
      todos
        .map((t: any) => t.category?.trim() || "")
        .filter((c: string) => c !== "" && c !== "未分类" && c !== "Uncategorized")
    )
  ) as string[];

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

  // Importance rank for sorting
  const importanceOrder: Record<string, number> = { "urgent": 0, "紧急": 0, "important": 1, "重要": 1, "normal": 2, "普通": 2, "low": 3, "低优先": 3 };
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

  const habitParents = sortedParents.filter((t: any) => t.kind === "habit" && !t.is_archived);
  const groupedSource = viewMode === "category"
    ? sortedParents.filter((t: any) => t.kind !== "habit" || t.is_archived)
    : sortedParents;

  const grouped = viewMode === "category"
    ? groupedSource.reduce((acc: Record<string, any[]>, t: any) => {
        const cat = t.category ? t.category.trim() : "";
        const key = cat === "" || cat === "未分类" || cat === "Uncategorized" ? "未分类" : cat;
        (acc[key] = acc[key] || []).push(t);
        return acc;
      }, {})
    : viewMode === "importance"
    ? groupedSource.reduce((acc: Record<string, any[]>, t: any) => {
        const impInfo = IMPORTANCE_MAP[t.importance] || IMPORTANCE_MAP["普通"];
        const impKey = impInfo.labelZh;
        (acc[impKey] = acc[impKey] || []).push(t);
        return acc;
      }, {})
    : { "全部": groupedSource };

  const groupedEntries = Object.entries(grouped).sort(([aKey], [bKey]) => {
    if (viewMode === "importance") {
      const order: Record<string, number> = { "紧急": 0, "重要": 1, "普通": 2, "低优先": 3 };
      return (order[aKey] ?? 99) - (order[bKey] ?? 99);
    }
    if (aKey === "未分类") return 1;
    if (bKey === "未分类") return -1;
    return aKey.localeCompare(bKey);
  });
  if (viewMode === "category" && habitParents.length > 0) {
    groupedEntries.unshift(["习惯", habitParents]);
  }

  const handleSaveMainTask = async () => {
    if (!form.title) { toast({ title: t("请填写标题", "Please fill title"), variant: "destructive" }); return; }
    try {
      const parsedTags = form.tags ? form.tags.split(/[,，]/).map(s => s.trim()).filter(Boolean) : undefined;
      await createMutation.mutateAsync({
        title: form.title,
        detail: form.detail || null,
        tags: parsedTags,
        importance: form.importance,
        category: form.kind === "habit" ? "习惯" : (form.category || "AI学习"),
        kind: form.kind,
        habit_type: form.kind === "habit" ? form.habit_type : null,
        habit_target: form.kind === "habit" && (form.habit_type === "count" || form.habit_type === "duration")
          ? Number(form.habit_target) || (form.habit_type === "duration" ? 30 : 1)
          : null,
        habit_unit: form.kind === "habit" ? (form.habit_unit || (form.habit_type === "duration" ? "分钟" : "次")) : null,
        is_paused: false,
        is_completed: false,
        is_archived: false,
      });
      setDialogOpen(false);
      setForm({ title: "", detail: "", tags: "", importance: "普通", category: "AI学习", kind: "once", habit_type: "checkin", habit_target: "", habit_unit: "" });
      toast({ title: t("主任务已添加", "Task added") });
    } catch (e: any) {
      toast({ title: t("保存失败", "Save failed"), description: e.message, variant: "destructive" });
    }
  };

  const handleOpenEdit = (item: any) => {
    setEditingTodo(item);
    const tagStr = Array.isArray(item.tags) ? item.tags.join(", ") : (item.tags || "");
    setEditForm({
      title: item.title,
      detail: item.detail || "",
      tags: tagStr,
      importance: item.importance || "普通",
      category: item.category || "AI学习",
      kind: item.kind || "once",
      habit_type: item.habit_type || "checkin",
      habit_target: item.habit_target != null ? String(item.habit_target) : "",
      habit_unit: item.habit_unit || "",
      is_paused: !!item.is_paused,
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editForm.title || !editingTodo) { toast({ title: t("请填写标题", "Please fill title"), variant: "destructive" }); return; }
    try {
      const parsedTags = editForm.tags ? editForm.tags.split(/[,，]/).map(s => s.trim()).filter(Boolean) : undefined;
      await updateMutation.mutateAsync({
        id: editingTodo.id,
        title: editForm.title,
        detail: editForm.detail || null,
        tags: parsedTags,
        importance: editForm.importance,
        category: editForm.kind === "habit" ? "习惯" : editForm.category,
        kind: editForm.kind,
        habit_type: editForm.kind === "habit" ? editForm.habit_type : null,
        habit_target: editForm.kind === "habit" && (editForm.habit_type === "count" || editForm.habit_type === "duration")
          ? Number(editForm.habit_target) || (editForm.habit_type === "duration" ? 30 : 1)
          : null,
        habit_unit: editForm.kind === "habit" ? (editForm.habit_unit || (editForm.habit_type === "duration" ? "分钟" : "次")) : null,
        is_paused: editForm.is_paused,
      });
      setEditDialogOpen(false);
      setEditingTodo(null);
      toast({ title: t("修改成功", "Updated successfully") });
    } catch (e: any) {
      toast({ title: t("保存失败", "Save failed"), description: e.message, variant: "destructive" });
    }
  };

  const toggleComplete = (item: any) => {
    if (isPersistentKind(item.kind)) return;
    updateMutation.mutate({ id: item.id, is_completed: !item.is_completed });
  };

  const handleAddSubtaskSubmit = async (parentId: string, parentCategory: string, parentImportance: string) => {
    const title = newSubtaskTitle.trim();
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
      setNewSubtaskTitle("");
      setAddingSubtaskFor(null);
      setExpandedTasks((prev) => ({ ...prev, [parentId]: true }));
      toast({ title: t("子任务已添加", "Subtask added") });
    } catch (e: any) {
      toast({ title: t("添加子任务失败", "Add subtask failed"), description: e.message, variant: "destructive" });
    }
  };

  const handleSaveSubtaskNote = async () => {
    if (!noteEditTodo) return;
    try {
      await updateMutation.mutateAsync({
        id: noteEditTodo.id,
        detail: noteContent.trim() || null,
      });
      setNoteEditTodo(null);
      toast({ title: t("备注已保存", "Note saved") });
    } catch (e: any) {
      toast({ title: t("保存备注失败", "Failed to save note"), description: e.message, variant: "destructive" });
    }
  };

  const handleSubtaskDragEnd = (result: DropResult, parentId: string, currentSubtasks: any[]) => {
    if (!result.destination) return;
    const { source, destination } = result;
    if (source.index === destination.index) return;

    const reordered = Array.from(currentSubtasks);
    const [moved] = reordered.splice(source.index, 1);
    reordered.splice(destination.index, 0, moved);

    setSubtaskOrders((prev) => ({
      ...prev,
      [parentId]: reordered.map((s: any) => s.id),
    }));
  };

  const renderTodoItem = (item: any, index: number = 0) => {
    const impInfo = IMPORTANCE_MAP[item.importance] || IMPORTANCE_MAP["普通"];
    const impLabel = t(impInfo.labelZh, impInfo.labelEn);
    const rawSubtasks = childTodos.filter((t: any) => t.parent_id === item.id);
    
    // Sort subtasks based on local drag order
    const orders = subtaskOrders[item.id];
    const itemSubtasks = orders && orders.length > 0
      ? [...rawSubtasks].sort((a: any, b: any) => {
          const idxA = orders.indexOf(a.id);
          const idxB = orders.indexOf(b.id);
          if (idxA === -1) return 1;
          if (idxB === -1) return -1;
          return idxA - idxB;
        })
      : rawSubtasks;

    const completedSubtasksCount = itemSubtasks.filter((s: any) => s.is_completed).length;
    const totalSubtasksCount = itemSubtasks.length;
    const progressPercent = totalSubtasksCount > 0 ? Math.round((completedSubtasksCount / totalSubtasksCount) * 100) : 0;

    const hasDetailsOrSubtasks = !!item.detail || totalSubtasksCount > 0 || (Array.isArray(item.tags) && item.tags.length > 0);
    const isExpanded = !!expandedTasks[item.id];

    // Tags processing
    let tagsList: string[] = [];
    if (Array.isArray(item.tags)) {
      tagsList = item.tags;
    } else if (typeof item.tags === "string" && item.tags.trim()) {
      tagsList = item.tags.split(/[,，]/).map((s: string) => s.trim());
    }

    return (
      <div key={item.id} style={{ ['--i' as any]: index }} className="enter-up space-y-2 mb-2.5">
        <div
          className={`bg-card rounded-2xl border border-border shadow-2xs transition-all duration-200 p-3.5 hover:border-border ${
            item.is_completed ? "opacity-60 bg-muted/40" : ""
          }`}
        >
          <div className="flex items-start gap-3">
            {/* Left toggle button: Chevron for tasks with subtasks, Solid Dot for tasks without subtasks */}
            <button
              type="button"
              onClick={(e) => handleTaskToggleClick(e, item.id)}
              aria-expanded={isExpanded}
              aria-label={isExpanded ? t("收起任务详情", "Collapse task") : t("展开任务详情", "Expand task")}
              className="mt-0.5 rounded-md text-muted-foreground hover:text-muted-foreground transition-colors shrink-0 cursor-pointer flex items-center justify-center w-5 h-5"
            >
              {totalSubtasksCount > 0 ? (
                isExpanded ? (
                  <ChevronDown className="h-4 w-4 text-[#5b88b5] stroke-[2.5]" />
                ) : (
                  <ChevronRight className="h-4 w-4 stroke-[2]" />
                )
              ) : (
                <span
                  className={`w-1.5 h-1.5 rounded-full transition-all ${
                    isExpanded ? "bg-cat-blue scale-125 shadow-2xs" : "bg-muted-foreground/40 hover:bg-cat-blue"
                  }`}
                />
              )}
            </button>

            {/* Checkbox — not for habits or routines */}
            {isPersistentKind(item.kind) ? (
              <span className="mt-0.5 h-5 w-5 rounded-full border-2 border-border bg-muted/40 flex items-center justify-center shrink-0" aria-hidden="true">
                <Repeat className="h-3 w-3 text-cat-orange" />
              </span>
            ) : (
            <button
              type="button"
              onClick={() => toggleComplete(item)}
              aria-label={item.is_completed ? t("标记为未完成", "Mark incomplete") : t("标记为已完成", "Mark complete")}
              aria-pressed={!!item.is_completed}
              className={`mt-0.5 h-5 w-5 rounded-full border-2 transition-all flex items-center justify-center shrink-0 ${
                item.is_completed
                  ? "bg-[#5b88b5] border-[#5b88b5] text-white"
                  : "border-border hover:border-[#5b88b5] bg-card"
              }`}
            >
              {item.is_completed && <Check className="h-3 w-3 stroke-[3]" />}
            </button>
            )}

            {/* Main Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  className={`text-left text-sm font-medium text-foreground leading-snug cursor-pointer bg-transparent border-0 p-0 ${
                    item.is_completed ? "line-through text-muted-foreground" : ""
                  }`}
                  onClick={(e) => handleTaskToggleClick(e, item.id)}
                >
                  {item.title}
                </button>

                {/* Right side status & controls (ALWAYS includes Priority Badge at top right) */}
                <div className="flex items-center gap-2 shrink-0 ml-auto">
                  {/* Collapsed view mini subtask progress indicator (ONLY if subtasks exist, FIXED width for single & double digits e.g. 4/4 vs 15/99) */}
                  {!isExpanded && totalSubtasksCount > 0 && (
                    <div className="flex items-center justify-between w-[86px] shrink-0 mr-1 bg-muted/40 px-2 py-0.5 rounded-lg border border-border">
                      <div className="h-1.5 w-9 bg-muted rounded-full overflow-hidden shrink-0 hidden sm:block">
                        <div
                          className="h-full bg-[#c69c4e] rounded-full transition-all duration-300"
                          style={{ width: `${progressPercent}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-medium text-muted-foreground font-mono tabular-nums w-[36px] text-right shrink-0">
                        {completedSubtasksCount}/{totalSubtasksCount}
                      </span>
                    </div>
                  )}

                  {item.kind === "routine" && (
                    <Badge variant="outline" className="text-xs px-2 py-0.5 rounded-full shrink-0 text-muted-foreground border-border">
                      {t("例行", "Routine")}
                    </Badge>
                  )}
                  {item.kind === "habit" && item.is_paused && (
                    <Badge variant="outline" className="text-xs px-2 py-0.5 rounded-full shrink-0 text-muted-foreground border-border">
                      {t("已暂停", "Paused")}
                    </Badge>
                  )}
                  {/* Priority Badge - ALWAYS at top right */}
                  <Badge variant="outline" className={`text-xs px-2.5 py-0.5 rounded-full shrink-0 ${impInfo.color}`}>
                    {impLabel}
                  </Badge>

                  {/* Action Menu */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        aria-label={t("任务操作菜单", "Task actions")}
                        className="p-1 rounded-md text-muted-foreground hover:text-muted-foreground hover:bg-muted/40 transition-colors shrink-0"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-36 rounded-xl border border-border shadow-md">
                      {isPersistentKind(item.kind) && (
                        <DropdownMenuItem
                          onClick={() => updateMutation.mutate({ id: item.id, is_paused: !item.is_paused })}
                          className="text-xs cursor-pointer"
                        >
                          {item.is_paused ? t("恢复", "Resume") : t("暂停", "Pause")}
                        </DropdownMenuItem>
                      )}
                      {!isPersistentKind(item.kind) && (
                      <DropdownMenuItem
                        onClick={() => {
                          setAddingSubtaskFor(item.id);
                          setExpandedTasks((prev) => ({ ...prev, [item.id]: true }));
                        }}
                        className="text-xs cursor-pointer"
                      >
                        <Plus className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                        {t("添加子任务", "Add Subtask")}
                      </DropdownMenuItem>
                      )}
                      <DropdownMenuItem onClick={() => handleOpenEdit(item)} className="text-xs cursor-pointer">
                        <Pencil className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                        {t("编辑任务", "Edit Task")}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => updateMutation.mutate({ id: item.id, is_archived: !item.is_archived })}
                        className="text-xs cursor-pointer"
                      >
                        {item.is_archived ? (
                          <>
                            <ArchiveRestore className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                            {t("取消归档", "Unarchive")}
                          </>
                        ) : (
                          <>
                            <Archive className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                            {t("归档任务", "Archive")}
                          </>
                        )}
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => deleteMutation.mutate(item.id)}
                        className="text-xs text-rose-600 focus:text-rose-600 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-2 text-rose-500" />
                        {t("删除", "Delete")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              {/* Expanded metadata section (tags & detail only, priority badge remains at top right) */}
              {isExpanded && (tagsList.length > 0 || item.detail) && (
                <div className="mt-2 pt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground border-t border-border">
                  {tagsList.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground font-normal">标签：</span>
                      <span className="text-muted-foreground font-medium">{tagsList.join(", ")}</span>
                    </div>
                  )}

                  {item.detail && (
                    <div className="w-full text-muted-foreground italic mt-1 bg-muted/40 p-2 rounded-lg text-xs">
                      {item.detail}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Expanded Subtasks Container */}
          {isExpanded && (
            totalSubtasksCount > 0 ? (
              <div className="bg-muted/40 border border-border rounded-xl p-3.5 mt-3 space-y-3">
                {/* Subtask Section Header */}
                <div className="flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-foreground">子任务</span>
                    <span className="text-muted-foreground font-medium">{completedSubtasksCount}/{totalSubtasksCount}</span>
                  </div>

                  {/* Progress bar line */}
                  <div className="flex-1 flex items-center max-w-xs sm:max-w-md mx-2">
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#c69c4e] rounded-full transition-all duration-300"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-muted-foreground font-normal ml-2 shrink-0">{progressPercent}%</span>
                  </div>

                  {/* Add subtask button */}
                  <button
                    type="button"
                    onClick={() => setAddingSubtaskFor(addingSubtaskFor === item.id ? null : item.id)}
                    className="bg-card hover:bg-muted/40 text-foreground border border-border rounded-lg px-2.5 py-1 text-xs font-medium shadow-2xs flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>添加子任务</span>
                  </button>
                </div>

                {/* Inline Quick Add Subtask Input */}
                {addingSubtaskFor === item.id && (
                  <div className="flex items-center gap-2 p-2 bg-card rounded-xl border border-[#c69c4e]/50 shadow-2xs animate-in fade-in duration-150">
                    <Input
                      value={newSubtaskTitle}
                      onChange={(e) => setNewSubtaskTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddSubtaskSubmit(item.id, item.category, item.importance);
                        if (e.key === "Escape") setAddingSubtaskFor(null);
                      }}
                      placeholder={t("输入子任务名称...", "Enter subtask title...")}
                      className="h-8 text-xs bg-card border border-border focus-visible:ring-1 focus-visible:ring-[#c69c4e] focus-visible:border-[#c69c4e] flex-1 shadow-2xs placeholder:text-muted-foreground"
                      autoFocus
                    />
                    <Button
                      size="sm"
                      onClick={() => handleAddSubtaskSubmit(item.id, item.category, item.importance)}
                      className="h-8 px-3 text-xs bg-[#c69c4e] hover:bg-[#b0883d] text-white rounded-lg"
                    >
                      {t("添加", "Add")}
                    </Button>
                    <button
                      type="button"
                      onClick={() => setAddingSubtaskFor(null)}
                      className="p-1 text-muted-foreground hover:text-muted-foreground rounded-md"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                )}

                {/* Subtask Items List with Drag & Drop */}
                <DragDropContext onDragEnd={(res) => handleSubtaskDragEnd(res, item.id, itemSubtasks)}>
                  <Droppable droppableId={`subtasks-${item.id}`}>
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className="space-y-2"
                      >
                        {itemSubtasks.map((sub: any, index: number) => (
                          <Draggable key={sub.id} draggableId={sub.id} index={index}>
                            {(dragProvided, dragSnapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                className={`bg-card hover:bg-muted/40 border border-border rounded-xl px-3 py-2.5 flex items-center gap-2.5 text-xs text-foreground shadow-2xs transition-colors duration-150 ${
                                  dragSnapshot.isDragging ? "shadow-md ring-2 ring-[#c69c4e]/40 z-20 opacity-95" : ""
                                } ${sub.is_completed ? "opacity-90" : ""}`}
                              >
                                {/* Drag handle icon */}
                                <div
                                  {...dragProvided.dragHandleProps}
                                  className="p-0.5 text-muted-foreground hover:text-muted-foreground cursor-grab active:cursor-grabbing shrink-0"
                                  aria-label={t(`拖动子任务“${sub.title}”排序`, `Reorder subtask “${sub.title}”`)}
                                >
                                  <GripVertical className="h-3.5 w-3.5" />
                                </div>

                                {/* Golden/Tan Checkbox when completed matching image */}
                                <button
                                  type="button"
                                  onClick={() => toggleComplete(sub)}
                                  aria-label={sub.is_completed ? t(`标记“${sub.title}”为未完成`, `Mark “${sub.title}” incomplete`) : t(`标记“${sub.title}”为已完成`, `Mark “${sub.title}” complete`)}
                                  className={`h-4 w-4 rounded flex items-center justify-center shrink-0 transition-all ${
                                    sub.is_completed
                                      ? "bg-[#c69c4e] text-white shadow-2xs"
                                      : "border-2 border-border hover:border-[#c69c4e] bg-card"
                                  }`}
                                >
                                  {sub.is_completed && <Check className="h-3 w-3 stroke-[3]" />}
                                </button>

                                {/* Subtask Title */}
                                <span
                                  className={`flex-1 min-w-0 font-medium text-foreground leading-snug cursor-pointer ${
                                    sub.is_completed ? "text-muted-foreground" : ""
                                  }`}
                                  onClick={() => toggleComplete(sub)}
                                >
                                  {sub.title}
                                </span>

                                {/* Right Subtask Actions */}
                                <div className="flex items-center gap-1.5 shrink-0">
                                  {/* ≡ 备注 Button */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setNoteEditTodo(sub);
                                      setNoteContent(sub.detail || "");
                                    }}
                                    className={`px-2 py-0.5 rounded flex items-center gap-1 font-medium text-[11px] transition-colors cursor-pointer ${
                                      sub.detail
                                        ? "bg-muted text-foreground hover:bg-muted/80"
                                        : "bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground"
                                    }`}
                                  >
                                    <AlignLeft className="h-3 w-3 text-muted-foreground" />
                                    <span>备注</span>
                                  </button>

                                  {/* Subtask Three-dots menu */}
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <button
                                        type="button"
                                        className="p-1 rounded-md text-muted-foreground hover:text-muted-foreground hover:bg-muted/40 transition-colors"
                                        aria-label={t(`子任务“${sub.title}”操作菜单`, `Actions for subtask “${sub.title}”`)}
                                      >
                                        <MoreHorizontal className="h-3.5 w-3.5" />
                                      </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-32 rounded-xl border border-border shadow-md">
                                      <DropdownMenuItem
                                        onClick={() => {
                                          setNoteEditTodo(sub);
                                          setNoteContent(sub.detail || "");
                                        }}
                                        className="text-xs cursor-pointer"
                                      >
                                        <Pencil className="h-3.5 w-3.5 mr-2 text-muted-foreground" />
                                        {t("编辑备注", "Edit Note")}
                                      </DropdownMenuItem>
                                      <DropdownMenuSeparator />
                                      <DropdownMenuItem
                                        onClick={() => deleteMutation.mutate(sub.id)}
                                        className="text-xs text-rose-600 focus:text-rose-600 cursor-pointer"
                                      >
                                        <Trash2 className="h-3.5 w-3.5 mr-2 text-rose-500" />
                                        {t("删除", "Delete")}
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </DragDropContext>
              </div>
            ) : (
              /* Slim, low-height compact row for tasks without subtasks */
              <div className="bg-muted/40 border border-border rounded-xl p-2 mt-2.5 flex items-center gap-2 animate-in fade-in duration-150">
                <Input
                  value={addingSubtaskFor === item.id ? newSubtaskTitle : ""}
                  onChange={(e) => {
                    setAddingSubtaskFor(item.id);
                    setNewSubtaskTitle(e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleAddSubtaskSubmit(item.id, item.category, item.importance);
                  }}
                  placeholder={t("添加首个子任务...", "Add subtask...")}
                  className="h-7 text-xs bg-card border border-border focus-visible:ring-1 focus-visible:ring-[#c69c4e] focus-visible:border-[#c69c4e] flex-1 shadow-2xs placeholder:text-muted-foreground"
                />
                <Button
                  size="sm"
                  onClick={() => handleAddSubtaskSubmit(item.id, item.category, item.importance)}
                  className="h-7 px-3 text-xs bg-[#c69c4e] hover:bg-[#b0883d] text-white rounded-lg shrink-0 flex items-center gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>添加</span>
                </Button>
              </div>
            )
          )}
        </div>
      </div>
    );
  };

  return (
    <AppLayout title={t("待办事项", "To-Dos")}>
      <div className="space-y-5 max-w-6xl mx-auto">
        {/* Top Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-card/50 p-2 rounded-2xl border border-border shadow-2xs">
          <div className="flex flex-wrap items-center gap-2">
            {/* View Mode Pills */}
            <div className="flex gap-1 bg-muted p-1 rounded-xl border border-border">
              {(["category", "importance", "all"] as const).map((mode) => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => setViewMode(mode)}
                  className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-all ${
                    viewMode === mode
                      ? "bg-primary text-primary-foreground shadow-2xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {mode === "category"
                    ? t("按分类", "By Category")
                    : mode === "importance"
                    ? t("按重要性", "By Priority")
                    : t("全部", "All")}
                </button>
              ))}
            </div>

            {/* Filter Pills */}
            <button
              type="button"
              onClick={() => setHideCompleted(!hideCompleted)}
              className={`px-3 py-1.5 text-xs font-medium rounded-xl border transition-colors ${
                hideCompleted
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted hover:bg-muted/80 text-foreground border-border"
              }`}
            >
              {hideCompleted ? t("显示已完成", "Show completed") : t("隐藏已完成", "Hide completed")}
            </button>

            <button
              type="button"
              onClick={() => setShowArchived(!showArchived)}
              className={`px-3 py-1.5 text-xs font-medium rounded-xl border transition-colors ${
                showArchived
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-muted hover:bg-muted/80 text-foreground border-border"
              }`}
            >
              {showArchived ? t("隐藏已归档", "Hide archived") : t("显示已归档", "Show archived")}
            </button>

            {hasCompletedNonArchived && (
              <button
                type="button"
                onClick={handleArchiveAllCompleted}
                className="px-3 py-1.5 text-xs font-medium rounded-xl bg-muted hover:bg-muted/80 text-foreground border border-border flex items-center gap-1.5 transition-colors"
              >
                <Archive className="h-3.5 w-3.5 text-muted-foreground" />
                <span>{t("归档已完成", "Archive completed")}</span>
              </button>
            )}
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={() => setDialogOpen(true)}
              className="bg-[#5b88b5] hover:bg-[#4a77a4] text-white px-4 py-1.5 text-xs font-medium rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>{t("添加主任务", "Add To-Do")}</span>
            </button>
          </div>
        </div>

        {/* Task List Grouped */}
        {groupedEntries.length === 0 ? (
          <div className="bg-card/60 border border-border rounded-2xl py-16 text-center shadow-2xs">
            <p className="text-muted-foreground text-sm font-medium">{t("暂无待办事项", "No to-dos")}</p>
          </div>
        ) : (
          groupedEntries.map(([group, items]) => {
            const isCategoryCollapsed = !!collapsedCategories[group];

            return (
              <div key={group} className="space-y-2">
                {viewMode !== "all" && (
                  <button
                    type="button"
                    onClick={(e) => handleCategoryToggleClick(e, group)}
                    aria-expanded={!isCategoryCollapsed}
                    aria-label={`${isCategoryCollapsed ? t("展开分类", "Expand category") : t("收起分类", "Collapse category")}: ${group === "未分类" ? t("未分类", "Uncategorized") : group}`}
                    className={`relative overflow-hidden w-full flex items-center justify-between transition-all cursor-pointer select-none text-left ${
                      isCategoryCollapsed
                        ? "bg-gradient-to-b from-[#f4eee4] to-[#e7ded0] dark:from-[#2c261e] dark:to-[#241f18] border border-[#d4c9b5] dark:border-[#4a4132] shadow-[0_2px_5px_rgba(0,0,0,0.06),0_1px_0_rgba(255,255,255,0.9)_inset] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] rounded-xl px-4 py-2.5 text-foreground hover:from-[#f0e7db] hover:to-[#e0d6c6] dark:hover:from-[#322b21] dark:hover:to-[#292318]"
                        : "bg-transparent border-transparent hover:bg-muted/40 pl-2 pr-2 py-2 text-foreground"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className={`p-1 rounded-md transition-colors shrink-0 flex items-center justify-center ${
                          isCategoryCollapsed
                            ? "bg-[#e2d7c4] dark:bg-[#3a3226] text-foreground shadow-[inset_0_1px_2px_rgba(0,0,0,0.08)] border border-[#caa170]/40"
                            : "text-muted-foreground"
                        }`}
                        aria-hidden="true"
                      >
                        {isCategoryCollapsed ? (
                          <ChevronRight className="h-3.5 w-3.5 stroke-[2.5]" />
                        ) : (
                          <ChevronDown className="h-3.5 w-3.5 stroke-[2.5]" />
                        )}
                      </span>

                      <div className="flex items-center gap-2">
                        <Folder className={`h-4 w-4 ${isCategoryCollapsed ? "text-[#b4883b] dark:text-[#c9a45a] fill-[#c69c4e]/20" : "text-muted-foreground"}`} />
                        <span className={`text-xs font-bold tracking-tight ${isCategoryCollapsed ? "text-foreground" : "text-foreground"}`}>
                          {group === "未分类"
                            ? t("未分类", "Uncategorized")
                            : viewMode === "importance"
                            ? t(group, IMPORTANCE_MAP[group]?.labelEn || group)
                            : group}
                        </span>
                        <span
                          className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded-md border ${
                            isCategoryCollapsed
                              ? "bg-[#e2d7c4] dark:bg-[#3a3226] text-[#6b4e18] dark:text-[#d9b57a] border-[#caa170]/40 shadow-[inset_0_1px_1px_rgba(0,0,0,0.05)]"
                              : "bg-muted/40 text-muted-foreground border-border"
                          }`}
                        >
                          {(items as any[]).length}
                        </span>
                      </div>
                    </div>

                    {/* Vintage Sealing Tape Strip (档案封条) */}
                    {isCategoryCollapsed && (
                      <div className="bg-[#e4cb9e] dark:bg-[#3d3221] text-[#6e4e14] dark:text-[#d9b57a] font-mono text-[10px] font-bold px-3 py-1 rounded-xs border border-[#c7ab74] dark:border-[#5a4a2e] shadow-2xs flex items-center gap-1.5 tracking-wider">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#b83227] shrink-0 shadow-2xs" />
                        <span>已折叠 · {(items as any[]).length} 项</span>
                      </div>
                    )}
                  </button>
                )}
                {!isCategoryCollapsed && (
                  <div className="space-y-1 animate-in fade-in duration-150">
                    {(items as any[]).map((item, itemIdx) => renderTodoItem(item, itemIdx))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Add Main Task Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">{t("添加待办主任务", "Add To-Do Task")}</DialogTitle>
            <DialogDescription>{t("填写任务内容与优先级，创建新的待办事项。", "Add the task details and priority.")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-3">
            <div>
              <Label htmlFor="todo-title" className="text-xs font-medium text-foreground">{t("任务标题", "Task Title")} *</Label>
              <Input
                id="todo-title"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="例如: ARIS 面试HTML"
                className="mt-1 h-9 text-xs"
              />
            </div>
            <div>
              <Label htmlFor="todo-tags" className="text-xs font-medium text-foreground">标签 (逗号分隔)</Label>
              <Input
                id="todo-tags"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="例如: Agent 相关, RAG 相关"
                className="mt-1 h-9 text-xs"
              />
            </div>
            <div>
              <Label htmlFor="todo-detail" className="text-xs font-medium text-foreground">{t("详细说明", "Details")}</Label>
              <Input
                id="todo-detail"
                value={form.detail}
                onChange={(e) => setForm({ ...form, detail: e.target.value })}
                placeholder="例如: 面试准备知识点梳理"
                className="mt-1 h-9 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="todo-kind" className="text-xs font-medium text-foreground">{t("种类", "Kind")}</Label>
                <select
                  id="todo-kind"
                  value={form.kind}
                  onChange={(e) => {
                    const kind = e.target.value;
                    setForm({
                      ...form,
                      kind,
                      category: kind === "habit" ? "习惯" : form.category === "习惯" ? "AI学习" : form.category,
                    });
                  }}
                  className="mt-1 block w-full h-9 rounded-lg border border-border bg-card px-3 py-1 text-xs text-foreground focus:border-[#5b88b5] focus:outline-none"
                >
                  <option value="once">{t("一次性", "Once")}</option>
                  <option value="routine">{t("例行", "Routine")}</option>
                  <option value="habit">{t("习惯", "Habit")}</option>
                </select>
              </div>
              <div>
                <Label htmlFor="todo-importance" className="text-xs font-medium text-foreground">{t("重要性", "Priority")}</Label>
                <select
                  id="todo-importance"
                  value={form.importance}
                  onChange={(e) => setForm({ ...form, importance: e.target.value })}
                  className="mt-1 block w-full h-9 rounded-lg border border-border bg-card px-3 py-1 text-xs text-foreground focus:border-[#5b88b5] focus:outline-none"
                >
                  {IMPORTANCE_LEVELS.map((l) => (
                    <option key={l.key} value={l.key}>
                      {l.key} ({l.labelEn})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="todo-category" className="text-xs font-medium text-foreground">{t("分类", "Category")}</Label>
                <CategoryInput
                  id="todo-category"
                  value={form.category}
                  onChange={(v) => setForm({ ...form, category: v })}
                  existingCategories={existingCategories}
                  placeholder="AI学习"
                />
              </div>
            </div>
            {form.kind === "habit" && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="todo-habit-type" className="text-xs font-medium text-foreground">{t("形态", "Type")}</Label>
                  <select
                    id="todo-habit-type"
                    value={form.habit_type}
                    onChange={(e) => setForm({ ...form, habit_type: e.target.value })}
                    className="mt-1 block w-full h-9 rounded-lg border border-border bg-card px-3 py-1 text-xs text-foreground"
                  >
                    <option value="checkin">{t("打卡", "Check-in")}</option>
                    <option value="count">{t("计数", "Count")}</option>
                    <option value="duration">{t("时长", "Duration")}</option>
                    <option value="avoidance">{t("克制", "Avoidance")}</option>
                  </select>
                </div>
                {(form.habit_type === "count" || form.habit_type === "duration") && (
                  <div>
                    <Label htmlFor="todo-habit-target" className="text-xs font-medium text-foreground">{t("目标", "Target")}</Label>
                    <Input
                      id="todo-habit-target"
                      value={form.habit_target}
                      onChange={(e) => setForm({ ...form, habit_target: e.target.value })}
                      placeholder={form.habit_type === "duration" ? "30" : "8"}
                      className="mt-1 h-9 text-xs"
                    />
                  </div>
                )}
              </div>
            )}
            <Button onClick={handleSaveMainTask} className="w-full mt-3 bg-[#5b88b5] hover:bg-[#4a77a4] text-white rounded-xl h-9 text-xs">
              {t("保存添加", "Add Task")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Main Task Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(o) => { setEditDialogOpen(o); if (!o) setEditingTodo(null); }}>
        <DialogContent className="max-w-md rounded-2xl p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">{t("编辑待办任务", "Edit Task")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-3">
            <div>
              <Label htmlFor="edit-title" className="text-xs font-medium text-foreground">{t("任务标题", "Task Title")} *</Label>
              <Input
                id="edit-title"
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                className="mt-1 h-9 text-xs"
              />
            </div>
            <div>
              <Label htmlFor="edit-tags" className="text-xs font-medium text-foreground">标签 (逗号分隔)</Label>
              <Input
                id="edit-tags"
                value={editForm.tags}
                onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
                className="mt-1 h-9 text-xs"
              />
            </div>
            <div>
              <Label htmlFor="edit-detail" className="text-xs font-medium text-foreground">{t("详细说明", "Details")}</Label>
              <Input
                id="edit-detail"
                value={editForm.detail}
                onChange={(e) => setEditForm({ ...editForm, detail: e.target.value })}
                className="mt-1 h-9 text-xs"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="edit-kind" className="text-xs font-medium text-foreground">{t("种类", "Kind")}</Label>
                <select
                  id="edit-kind"
                  value={editForm.kind}
                  onChange={(e) => setEditForm({ ...editForm, kind: e.target.value })}
                  className="mt-1 block w-full h-9 rounded-lg border border-border bg-card px-3 py-1 text-xs text-foreground"
                >
                  <option value="once">{t("一次性", "Once")}</option>
                  <option value="routine">{t("例行", "Routine")}</option>
                  <option value="habit">{t("习惯", "Habit")}</option>
                </select>
              </div>
              <div>
                <Label htmlFor="edit-importance" className="text-xs font-medium text-foreground">{t("重要性", "Priority")}</Label>
                <select
                  id="edit-importance"
                  value={editForm.importance}
                  onChange={(e) => setEditForm({ ...editForm, importance: e.target.value })}
                  className="mt-1 block w-full h-9 rounded-lg border border-border bg-card px-3 py-1 text-xs text-foreground focus:border-[#5b88b5] focus:outline-none"
                >
                  {IMPORTANCE_LEVELS.map((l) => (
                    <option key={l.key} value={l.key}>
                      {l.key} ({l.labelEn})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="edit-category" className="text-xs font-medium text-foreground">{t("分类", "Category")}</Label>
                <CategoryInput
                  id="edit-category"
                  value={editForm.category}
                  onChange={(v) => setEditForm({ ...editForm, category: v })}
                  existingCategories={existingCategories}
                />
              </div>
            </div>
            <Button onClick={handleSaveEdit} className="w-full mt-3 bg-[#5b88b5] hover:bg-[#4a77a4] text-white rounded-xl h-9 text-xs">
              {t("保存修改", "Save Changes")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Subtask Note / Detail Modal */}
      <Dialog open={!!noteEditTodo} onOpenChange={(o) => { if (!o) setNoteEditTodo(null); }}>
        <DialogContent className="max-w-sm rounded-2xl p-5">
          <DialogHeader>
            <DialogTitle className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
              <AlignLeft className="h-4 w-4 text-[#c69c4e]" />
              <span>编辑子任务备注</span>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 mt-2">
            <p className="text-xs text-muted-foreground font-medium line-clamp-2 bg-muted/40 p-2 rounded-lg border border-border">
              {noteEditTodo?.title}
            </p>
            <div>
              <Label htmlFor="subtask-note" className="text-xs text-muted-foreground font-medium">备注详情 / 说明</Label>
              <textarea
                id="subtask-note"
                value={noteContent}
                onChange={(e) => setNoteContent(e.target.value)}
                placeholder="输入备注内容或补充说明..."
                rows={4}
                className="mt-1 w-full rounded-xl border border-border bg-muted/40 p-2.5 text-xs text-foreground focus:bg-card focus:border-[#c69c4e] focus:outline-none focus:ring-1 focus:ring-[#c69c4e]"
              />
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <Button variant="outline" size="sm" onClick={() => setNoteEditTodo(null)} className="h-8 text-xs rounded-lg">
                取消
              </Button>
              <Button size="sm" onClick={handleSaveSubtaskNote} className="h-8 text-xs bg-[#c69c4e] hover:bg-[#b0883d] text-white rounded-lg px-4">
                保存备注
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
