import { useState, useRef, useLayoutEffect } from "react";
import { motion } from "motion/react";
import { useLocation } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import BottomSheet from "@/vendor/uiarc/registry/components/bottom-sheet/bottom-sheet";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { ClipboardList } from "lucide-react";
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
import { ArcScope } from "@/components/arc/ArcScope";
import ConfirmMorph, { type ConfirmMorphState } from "@/vendor/uiarc/registry/components/confirm-morph/confirm-morph";
import FilterToolbar, { type FilterChip, type FilterField, type FilterOption } from "@/vendor/uiarc/registry/components/filter-toolbar/filter-toolbar";
import InlineEdit from "@/vendor/uiarc/registry/components/inline-edit/inline-edit";
import SegmentedControl from "@/vendor/uiarc/registry/components/segmented-control/segmented-control";

const IMPORTANCE_LEVELS = [
  { key: "紧急", labelEn: "Urgent", variant: "tint-destructive" as const },
  { key: "重要", labelEn: "Important", variant: "tint-accent" as const },
  { key: "普通", labelEn: "Normal", variant: "tint-info" as const },
  { key: "低优先", labelEn: "Low", variant: "tint" as const },
] as const;

const IMPORTANCE_MAP: Record<string, { labelZh: string; labelEn: string; variant: (typeof IMPORTANCE_LEVELS)[number]["variant"] }> = {
  urgent: { labelZh: "紧急", labelEn: "Urgent", variant: "tint-destructive" },
  紧急: { labelZh: "紧急", labelEn: "Urgent", variant: "tint-destructive" },
  important: { labelZh: "重要", labelEn: "Important", variant: "tint-accent" },
  重要: { labelZh: "重要", labelEn: "Important", variant: "tint-accent" },
  normal: { labelZh: "普通", labelEn: "Normal", variant: "tint-info" },
  普通: { labelZh: "普通", labelEn: "Normal", variant: "tint-info" },
  low: { labelZh: "低优先", labelEn: "Low", variant: "tint" },
  低优先: { labelZh: "低优先", labelEn: "Low", variant: "tint" },
};

type ViewMode = "category" | "importance" | "all";
const CATEGORY_FILTER_ID = "category";
const COMPLETION_FILTER_ID = "completion";
const ARCHIVE_FILTER_ID = "archive";
const UNCATEGORIZED_FILTER_VALUE = "__uncategorized__";

type AppliedFilter = { id: string; value: string };

const DEFAULT_TODO_CATEGORY = "未分类";
const EMPTY_TODO_FORM = {
  title: "",
  detail: "",
  tags: "",
  importance: "普通",
  category: "",
  kind: "once",
  habit_type: "checkin",
  habit_target: "",
  habit_unit: "",
};

const CategoryInput = ({ id, value, onChange, existingCategories, placeholder }: {
  id?: string;
  value: string;
  onChange: (val: string) => void;
  existingCategories: string[];
  placeholder?: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const { t } = useLang();
  return (
    <div className="relative mt-1">
      <div className="relative flex items-center">
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="pr-8 h-9 text-sm"
          aria-expanded={existingCategories.length > 0 ? isOpen : undefined}
          aria-haspopup={existingCategories.length > 0 ? "listbox" : undefined}
        />
        {existingCategories.length > 0 && (
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="absolute right-2 text-muted-foreground hover:text-muted-foreground focus:outline-none"
            style={{ zIndex: 5 }}
            aria-label={isOpen ? t("收起分类列表", "Collapse category list") : t("展开分类列表", "Expand category list")}
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
  const [filters, setFilters] = useState<AppliedFilter[]>([]);
  const [archivedBatch, setArchivedBatch] = useState<string[]>([]);
  const [archivePending, setArchivePending] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(openCreateFromDashboard);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<{ id: string; title: string } | null>(null);
  
  // Forms
  const [form, setForm] = useState({ ...EMPTY_TODO_FORM });
  const [editingTodo, setEditingTodo] = useState<any>(null);
  const [editForm, setEditForm] = useState({ ...EMPTY_TODO_FORM, is_paused: false });

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

  // Filters apply to parent todos before the existing habit pinning and view grouping.
  const categoryFilter = filters.find((filter) => filter.id === CATEGORY_FILTER_ID)?.value;
  const completionFilter = filters.find((filter) => filter.id === COMPLETION_FILTER_ID)?.value;
  const archiveFilter = filters.find((filter) => filter.id === ARCHIVE_FILTER_ID)?.value;
  const nonArchivedParents = parentTodos.filter((t: any) => !t.is_archived);
  const hasCompletedNonArchived = nonArchivedParents.some((t: any) => t.is_completed);
  const filteredParents = parentTodos.filter((todo: any) => {
    if (archiveFilter === "archived") {
      if (!todo.is_archived) return false;
    } else if (archiveFilter !== "all" && todo.is_archived) {
      return false;
    }

    if (completionFilter === "completed" && !todo.is_completed) return false;
    if (completionFilter === "incomplete" && todo.is_completed) return false;

    if (categoryFilter) {
      const category = todo.category?.trim() || "";
      const normalizedCategory = category === "" || category === "未分类" || category === "Uncategorized"
        ? UNCATEGORIZED_FILTER_VALUE
        : category;
      if (normalizedCategory !== categoryFilter) return false;
    }

    return true;
  });

  // Importance rank for sorting
  const importanceOrder: Record<string, number> = { "urgent": 0, "紧急": 0, "important": 1, "重要": 1, "normal": 2, "普通": 2, "low": 3, "低优先": 3 };
  const sortedParents = [...filteredParents].sort((a: any, b: any) => {
    if (a.is_archived !== b.is_archived) return a.is_archived ? 1 : -1;
    if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1;
    return (importanceOrder[a.importance] ?? 2) - (importanceOrder[b.importance] ?? 2);
  });

  const handleArchiveAllCompleted = async () => {
    const completedIds = nonArchivedParents.filter((todo: any) => todo.is_completed).map((todo: any) => todo.id);
    setArchivePending(true);
    try {
      const results = await Promise.allSettled(
        completedIds.map((id: string) => updateMutation.mutateAsync({ id, is_archived: true })),
      );
      const archivedIds = completedIds.filter((_, index) => results[index].status === "fulfilled");
      setArchivedBatch((current) => [...new Set([...current, ...archivedIds])]);
      const failure = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
      if (failure) throw failure.reason;
    } finally {
      setArchivePending(false);
    }
  };

  const handleRestoreArchivedBatch = async () => {
    const ids = archivedBatch;
    const results = await Promise.allSettled(ids.map((id) => updateMutation.mutateAsync({ id, is_archived: false })));
    const remainingIds = ids.filter((_, index) => results[index].status === "rejected");
    setArchivedBatch(remainingIds);
    const failure = results.find((result): result is PromiseRejectedResult => result.status === "rejected");
    if (failure) throw failure.reason;
  };

  const filterFields: FilterField[] = [
    {
      id: CATEGORY_FILTER_ID,
      label: t("分类", "Category"),
      options: [
        ...existingCategories.map((category): FilterOption => ({ value: category, label: category })),
        { value: UNCATEGORIZED_FILTER_VALUE, label: t("未分类", "Uncategorized") },
      ],
    },
    {
      id: COMPLETION_FILTER_ID,
      label: t("完成状态", "Completion"),
      options: [
        { value: "incomplete", label: t("未完成", "Incomplete") },
        { value: "completed", label: t("已完成", "Completed") },
      ],
    },
    {
      id: ARCHIVE_FILTER_ID,
      label: t("归档状态", "Archive status"),
      options: [
        { value: "active", label: t("未归档", "Not archived") },
        { value: "archived", label: t("已归档", "Archived") },
        { value: "all", label: t("包含已归档", "Include archived") },
      ],
    },
  ];

  const handleAddFilter = (filter: FilterChip, field: FilterField) => {
    const selectedOption = field.options
      .map((option) => typeof option === "string" ? { value: option } : option)
      .find((option) => (option.label ?? option.value) === filter.value);
    if (!selectedOption) return;

    if (filter.id === ARCHIVE_FILTER_ID && selectedOption.value === "active") {
      setFilters((current) => current.filter((entry) => entry.id !== filter.id));
      return;
    }
    setFilters((current) => [
      ...current.filter((entry) => entry.id !== filter.id),
      { id: filter.id, value: selectedOption.value },
    ]);
  };

  const displayFilters: FilterChip[] = filters.map((filter) => {
    const field = filterFields.find((entry) => entry.id === filter.id);
    const option = field?.options
      .map((entry) => typeof entry === "string" ? { value: entry } : entry)
      .find((entry) => entry.value === filter.value);
    return {
      id: filter.id,
      label: field?.label ?? filter.id,
      value: option?.label ?? option?.value ?? filter.value,
    };
  });

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
        category: form.kind === "habit" ? "习惯" : (form.category.trim() || DEFAULT_TODO_CATEGORY),
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
      setForm({ ...EMPTY_TODO_FORM });
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
      category: item.category || "",
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
          className={`bg-card rounded-lg border border-border transition-all duration-200 p-3.5 hover:border-[var(--line-strong)] ${
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
                  <ChevronDown className="h-4 w-4 text-cat-blue stroke-[2.5]" />
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
                  ? "bg-cat-blue border-cat-blue text-white"
                  : "border-border hover:border-cat-blue bg-card"
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
                    <div className="flex items-center justify-between w-[86px] shrink-0 mr-1 bg-muted px-2 py-0.5 rounded-md border border-border">
                      <div className="h-1.5 w-9 bg-background rounded-full overflow-hidden shrink-0 hidden sm:block">
                        <div
                          className="h-full bg-cat-yellow rounded-full transition-all duration-300"
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
                  <Badge variant={impInfo.variant} className="text-xs px-2.5 py-0.5 rounded-full shrink-0">
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
                    <DropdownMenuContent align="end" className="w-36 rounded-lg border border-border shadow-md">
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
                        onClick={() => setPendingDelete({ id: item.id, title: item.title })}
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
              {isExpanded && (
                <div className="mt-2 pt-1.5 flex flex-wrap items-center gap-3 text-xs text-muted-foreground border-t border-border">
                  {tagsList.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground font-normal">标签：</span>
                      <span className="text-muted-foreground font-medium">{tagsList.join(", ")}</span>
                    </div>
                  )}

                  <div className="w-full text-muted-foreground italic mt-1 bg-muted/40 p-2 rounded-md text-xs">
                    <ArcScope className="block">
                      <InlineEdit
                        value={item.detail ?? ""}
                        label={t("详细说明", "Details")}
                        variant="body"
                        multiline
                        placeholder={t("添加详细说明...", "Add details...")}
                        onSave={async (detail) => updateMutation.mutateAsync({ id: item.id, detail: detail.trim() || null })}
                      />
                    </ArcScope>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Expanded Subtasks Container */}
          {isExpanded && (
            totalSubtasksCount > 0 ? (
              <div className="bg-muted/40 border border-border rounded-lg p-3.5 mt-3 space-y-3">
                {/* Subtask Section Header */}
                <div className="flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-foreground">{t("子任务", "Subtasks")}</span>
                    <span className="text-muted-foreground font-medium">{completedSubtasksCount}/{totalSubtasksCount}</span>
                  </div>

                  {/* Progress bar line */}
                  <div className="flex-1 flex items-center max-w-xs sm:max-w-md mx-2">
                    <div className="h-1.5 w-full bg-background rounded-full overflow-hidden">
                      <div
                        className="h-full bg-cat-yellow rounded-full transition-all duration-300"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-muted-foreground font-normal ml-2 shrink-0">{progressPercent}%</span>
                  </div>

                  {/* Add subtask button */}
                  <button
                    type="button"
                    onClick={() => setAddingSubtaskFor(addingSubtaskFor === item.id ? null : item.id)}
                    className="bg-card hover:bg-muted/40 text-foreground border border-border rounded-md px-2.5 min-h-8 text-xs font-medium flex items-center gap-1 shrink-0 transition-colors cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                    <span>{t("添加子任务", "Add Subtask")}</span>
                  </button>
                </div>

                {/* Inline Quick Add Subtask Input */}
                {addingSubtaskFor === item.id && (
                  <div className="flex items-center gap-2 p-2 bg-card rounded-lg border border-cat-yellow/50 animate-in fade-in duration-150">
                    <Input
                      value={newSubtaskTitle}
                      onChange={(e) => setNewSubtaskTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleAddSubtaskSubmit(item.id, item.category, item.importance);
                        if (e.key === "Escape") setAddingSubtaskFor(null);
                      }}
                      placeholder={t("输入子任务名称...", "Enter subtask title...")}
                      className="h-8 text-xs bg-card border border-border focus-visible:ring-1 focus-visible:ring-cat-yellow focus-visible:border-cat-yellow flex-1 placeholder:text-muted-foreground"
                      autoFocus
                    />
                    <Button
                      size="sm"
                      onClick={() => handleAddSubtaskSubmit(item.id, item.category, item.importance)}
                      className="h-8 px-3 text-xs"
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
                                className={`bg-card hover:bg-muted/40 border border-border rounded-md px-3 py-2.5 flex items-center gap-2.5 text-xs text-foreground transition-colors duration-150 ${
                                  dragSnapshot.isDragging ? "shadow-md ring-2 ring-cat-yellow/40 z-20 opacity-95" : ""
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
                                      ? "bg-cat-yellow text-white"
                                      : "border-2 border-border hover:border-cat-yellow bg-card"
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
                                    <span>{t("备注", "Note")}</span>
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
                                    <DropdownMenuContent align="end" className="w-32 rounded-lg border border-border shadow-md">
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
                                        onClick={() => setPendingDelete({ id: sub.id, title: sub.title })}
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
              <div className="bg-muted/40 border border-border rounded-lg p-2 mt-2.5 flex items-center gap-2 animate-in fade-in duration-150">
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
                  className="h-7 text-xs bg-card border border-border focus-visible:ring-1 focus-visible:ring-cat-yellow focus-visible:border-cat-yellow flex-1 placeholder:text-muted-foreground"
                />
                <Button
                  size="sm"
                  onClick={() => handleAddSubtaskSubmit(item.id, item.category, item.importance)}
                  className="h-7 px-3 text-xs shrink-0 flex items-center gap-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>{t("添加", "Add")}</span>
                </Button>
              </div>
            )
          )}
        </div>
      </div>
    );
  };

  const addTaskForm = (
    <div className="space-y-4">
      <div>
        <Label htmlFor="todo-title" className="text-xs font-medium text-foreground">{t("任务标题", "Task Title")} *</Label>
        <Input
          id="todo-title"
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder={t("例如：预约下周体检", "e.g. Book a checkup")}
          className="mt-1 h-9 text-sm"
        />
      </div>
      <div>
        <Label htmlFor="todo-tags" className="text-xs font-medium text-foreground">{t("标签（逗号分隔）", "Tags (comma-separated)")}</Label>
        <Input
          id="todo-tags"
          value={form.tags}
          onChange={(e) => setForm({ ...form, tags: e.target.value })}
          placeholder={t("例如：周末, 家里", "e.g. weekend, home")}
          className="mt-1 h-9 text-sm"
        />
      </div>
      <div>
        <Label htmlFor="todo-detail" className="text-xs font-medium text-foreground">{t("详细说明", "Details")}</Label>
        <Input
          id="todo-detail"
          value={form.detail}
          onChange={(e) => setForm({ ...form, detail: e.target.value })}
          placeholder={t("例如：下班路上顺便处理", "e.g. Handle it on the way home")}
          className="mt-1 h-9 text-sm"
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
                category: kind === "habit" ? "习惯" : form.category === "习惯" ? "" : form.category,
              });
            }}
            className="native-select mt-1 block w-full rounded-md border border-border bg-card px-3 text-base text-foreground"
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
            className="native-select mt-1 block w-full rounded-md border border-border bg-card px-3 text-base text-foreground"
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
            placeholder={t("例如：生活", "e.g. Life")}
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
              className="native-select mt-1 block w-full rounded-md border border-border bg-card px-3 text-base text-foreground"
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
                className="mt-1 h-9 text-sm"
              />
            </div>
          )}
        </div>
      )}
      <Button onClick={handleSaveMainTask} className="w-full mt-3 h-9">
        {t("保存添加", "Add Task")}
      </Button>
    </div>
  );

  const editTaskForm = (
    <div className="space-y-4">
      <div>
        <Label htmlFor="edit-title" className="text-xs font-medium text-foreground">{t("任务标题", "Task Title")} *</Label>
        <Input
          id="edit-title"
          value={editForm.title}
          onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
          className="mt-1 h-9 text-sm"
        />
      </div>
      <div>
        <Label htmlFor="edit-tags" className="text-xs font-medium text-foreground">{t("标签（逗号分隔）", "Tags (comma-separated)")}</Label>
        <Input
          id="edit-tags"
          value={editForm.tags}
          onChange={(e) => setEditForm({ ...editForm, tags: e.target.value })}
          className="mt-1 h-9 text-sm"
        />
      </div>
      <div>
        <Label htmlFor="edit-detail" className="text-xs font-medium text-foreground">{t("详细说明", "Details")}</Label>
        <Input
          id="edit-detail"
          value={editForm.detail}
          onChange={(e) => setEditForm({ ...editForm, detail: e.target.value })}
          className="mt-1 h-9 text-sm"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="edit-kind" className="text-xs font-medium text-foreground">{t("种类", "Kind")}</Label>
          <select
            id="edit-kind"
            value={editForm.kind}
            onChange={(e) => setEditForm({ ...editForm, kind: e.target.value })}
            className="native-select mt-1 block w-full rounded-md border border-border bg-card px-3 text-base text-foreground"
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
            className="native-select mt-1 block w-full rounded-md border border-border bg-card px-3 text-base text-foreground"
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
      <Button onClick={handleSaveEdit} className="w-full mt-3 h-9">
        {t("保存修改", "Save Changes")}
      </Button>
    </div>
  );

  const subtaskNoteForm = (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground font-medium line-clamp-2 bg-muted/40 p-2 rounded-md border border-border">
        {noteEditTodo?.title}
      </p>
      <div>
        <Label htmlFor="subtask-note" className="text-xs text-muted-foreground font-medium">{t("备注详情 / 说明", "Note details")}</Label>
        <textarea
          id="subtask-note"
          value={noteContent}
          onChange={(e) => setNoteContent(e.target.value)}
          placeholder={t("输入备注内容或补充说明...", "Add a note or extra context...")}
          rows={4}
          className="mt-1 w-full rounded-md border border-border bg-muted/40 p-2.5 text-sm text-foreground focus:bg-card focus:border-cat-yellow focus:outline-none focus:ring-1 focus:ring-cat-yellow"
        />
      </div>
      <div className="flex gap-2 justify-end pt-1">
        <Button variant="outline" size="sm" onClick={() => setNoteEditTodo(null)} className="h-8 text-xs">
          {t("取消", "Cancel")}
        </Button>
        <Button size="sm" onClick={handleSaveSubtaskNote} className="h-8 text-xs px-4">
          {t("保存备注", "Save Note")}
        </Button>
      </div>
    </div>
  );

  return (
    <AppLayout title={t("待办事项", "To-Dos")}>
      <div className="space-y-5 max-w-6xl mx-auto">
        {/* Top Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-2 rounded-lg border border-border">
          <div className="min-w-0 flex-1">
            <ArcScope className="flex flex-wrap items-center gap-2">
              <SegmentedControl
                options={[
                  { value: "category", label: t("按分类", "By Category") },
                  { value: "importance", label: t("按重要性", "By Priority") },
                  { value: "all", label: t("全部", "All") },
                ]}
                value={viewMode}
                onValueChange={(value) => setViewMode(value as ViewMode)}
                label={t("任务视图", "Task view")}
              />
              <div className="todo-filter-fit">
              <FilterToolbar
                filters={displayFilters}
                onRemove={(id) => setFilters((current) => current.filter((filter) => filter.id !== id))}
                onClearAll={() => setFilters([])}
                label={t("任务筛选", "Task filters")}
                addFilter={{ fields: filterFields, onAdd: handleAddFilter, label: t("添加筛选", "Add filter"), align: "start" }}
              />
              </div>
              {(hasCompletedNonArchived || archivedBatch.length > 0 || archivePending) && (
                <ConfirmMorph
  className="confirm-quiet"
                  icon={<Archive className="h-4 w-4" />}
                  label={t("归档已完成", "Archive completed")}
                  prompt={t("归档所有已完成任务？", "Archive all completed tasks?")}
                  confirmLabel={t("确认归档", "Archive")}
                  cancelLabel={t("取消", "Cancel")}
                  pendingLabel={t("正在归档…", "Archiving…")}
                  doneLabel={t("归档完成", "Archived")}
                  errorLabel={t("归档失败", "Archive failed")}
                  retryLabel={t("重试", "Retry")}
                  undoLabel={t("撤销归档", "Undo archive")}
                  undoingLabel={t("正在撤销…", "Undoing…")}
                  tone="neutral"
                  onConfirm={handleArchiveAllCompleted}
                  onUndo={archivedBatch.length > 0 ? handleRestoreArchivedBatch : undefined}
                  onStateChange={(state: ConfirmMorphState) => {
                    if (state === "confirming") setArchivedBatch([]);
                  }}
                />
              )}
            </ArcScope>
          </div>

          {/* Right Action Buttons */}
          <div className="flex items-center gap-2 ml-auto">
            <Button
              onClick={() => setDialogOpen(true)}
              className="h-9"
            >
              <Plus className="h-4 w-4" />
              <span>{t("添加主任务", "Add To-Do")}</span>
            </Button>
          </div>
        </div>

        {/* Task List Grouped */}
        {groupedEntries.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            title={t("暂无待办事项", "No to-dos")}
            hint={t("从一条主任务开始，子任务和进度会跟着长出来。", "Start with one task; subtasks and progress grow from there.")}
            action={<Button onClick={() => setDialogOpen(true)} className="h-9"><Plus className="h-4 w-4" />{t("添加主任务", "Add To-Do")}</Button>}
          />
        ) : (
          groupedEntries.map(([group, items]) => {
            const isCategoryCollapsed = !!collapsedCategories[group];
            const rows = items as any[];
            const groupLabel = group === "未分类"
              ? t("未分类", "Uncategorized")
              : viewMode === "importance"
              ? t(group, IMPORTANCE_MAP[group]?.labelEn || group)
              : group;
            const unfinished = rows.filter((row) => !row.is_completed);

            const taskList = (
              <div className="space-y-1 pt-2">
                {rows.map((item) => (
                  <motion.div key={item.id} layout="position" transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}>
                    {renderTodoItem(item)}
                  </motion.div>
                ))}
              </div>
            );

            return (
              <div key={group}>
                {viewMode === "all" ? taskList : (
                  <div className="todo-fold" data-folded={isCategoryCollapsed || undefined}>
                    <button
                      type="button"
                      onClick={(e) => handleCategoryToggleClick(e, group)}
                      aria-expanded={!isCategoryCollapsed}
                      aria-label={`${isCategoryCollapsed ? t("展开分类", "Expand category") : t("收起分类", "Collapse category")}: ${groupLabel}`}
                      className="todo-fold-head flex w-full min-w-0 items-center gap-2 px-3 py-2.5 text-left"
                    >
                      <ChevronDown className="todo-fold-chevron h-4 w-4 shrink-0 text-muted-foreground" />
                      <Folder className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="shrink-0 text-sm font-medium leading-5 text-foreground">{groupLabel}</span>
                      <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">{unfinished.length}/{rows.length}</span>
                      {isCategoryCollapsed && unfinished[0] && (
                        <span className="min-w-0 truncate text-xs text-muted-foreground">· {unfinished[0].title}</span>
                      )}
                    </button>
                    <div className="todo-fold-list" inert={isCategoryCollapsed || undefined}>
                      <div>{taskList}</div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

            {/* Add Main Task — rises from the bottom, opens at the tall detent */}
      <BottomSheet
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={t("添加待办主任务", "Add To-Do Task")}
        description={t("填写任务内容与优先级，创建新的待办事项。", "Add the task details and priority.")}
        detents={[0.72, 0.94]}
        initialDetent={1}
        className="arc-runtime"
        closeLabel={t("关闭", "Close")}
      >
        {addTaskForm}
      </BottomSheet>

            {/* Edit Main Task — rises from the bottom, opens at the tall detent */}
      <BottomSheet
        open={editDialogOpen}
        onOpenChange={(o) => { setEditDialogOpen(o); if (!o) setEditingTodo(null); }}
        title={t("编辑待办任务", "Edit Task")}
        description={t("修改标题、优先级和分类。", "Change the title, priority, and category.")}
        detents={[0.72, 0.94]}
        initialDetent={1}
        className="arc-runtime"
        closeLabel={t("关闭", "Close")}
      >
        {editTaskForm}
      </BottomSheet>

            {/* Subtask Note — rises from the bottom, opens at the tall detent */}
      <BottomSheet
        open={!!noteEditTodo}
        onOpenChange={(o) => { if (!o) setNoteEditTodo(null); }}
        title={t("编辑子任务备注", "Edit Subtask Note")}
        description={noteEditTodo?.title || t("补充这条子任务的说明。", "Add a note for this subtask.")}
        detents={[0.55, 0.82]}
        initialDetent={1}
        className="arc-runtime"
        closeLabel={t("关闭", "Close")}
      >
        {subtaskNoteForm}
      </BottomSheet>

      {/* Destructive confirmation for task / subtask deletes */}
      <AlertDialog open={!!pendingDelete} onOpenChange={(open) => { if (!open) setPendingDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("删除这条任务？", "Delete this task?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(`「${pendingDelete?.title ?? ""}」将被删除，且无法恢复。`, `“${pendingDelete?.title ?? ""}” will be deleted and cannot be undone.`)}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("取消", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingDelete) deleteMutation.mutate(pendingDelete.id);
                setPendingDelete(null);
              }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {t("删除", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
