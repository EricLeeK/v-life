import { moduleFigure } from "@/components/concepts/catalog";
import { HairlineFigure } from "@/components/concepts/HairlineFigure";
import { useState, useMemo } from "react";
import { BoardColumn } from "./BoardColumn";
import { TaskCard } from "./TaskCard";
import { HabitCard } from "./HabitCard";
import { MilestoneCard } from "./MilestoneCard";
import { TaskModal } from "./TaskModal";
import { ProjectEditActions } from "./ProjectEditActions";
import { ProjectDeleteDialog } from "./ProjectDeleteDialog";
import { useProjectTasks, useUpdateProjectTask, useUpdateProject, useCreateProjectTask, useDeleteProjectTask } from "@/hooks/useData";
import { useToast } from "@/hooks/use-toast";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Pencil, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLang } from "@/contexts/LanguageContext";
import type { Tables } from "@/integrations/supabase/types";

const COLUMNS_ZH = [
  { id: "todo", title: "待办" },
  { id: "this_week", title: "本周" },
  { id: "in_progress", title: "进行中" },
  { id: "waiting", title: "等待中" },
  { id: "done", title: "已完成" },
] as const;
const COLUMN_TITLE_MAP: Record<string, string> = {
  "待办": "To Do", "本周": "This Week", "进行中": "In Progress", "等待中": "Waiting", "已完成": "Done",
};

type FilterType = "all" | "task" | "habit" | "milestone";

interface ProjectBoardProps {
  project: any;
  onEditProject: () => void;
  onDeleteProject: () => void;
  editMode: boolean;
  onToggleEditMode: () => void;
}

export function ProjectBoard({ project, onEditProject, onDeleteProject, editMode, onToggleEditMode }: ProjectBoardProps) {
  const { t, lang } = useLang();
  const { data: tasks = [] } = useProjectTasks(project.id);
  const updateTask = useUpdateProjectTask();
  const updateProject = useUpdateProject();
  const createTask = useCreateProjectTask();
  const deleteTask = useDeleteProjectTask();
  const { toast } = useToast();
  const [filter, setFilter] = useState<FilterType>("all");
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"task" | "habit" | "milestone">("task");
  const [editingTask, setEditingTask] = useState<any>(null);
  const [deletingTask, setDeletingTask] = useState<Tables<"project_tasks"> | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const filteredTasks = useMemo(() => {
    if (filter === "all") return tasks;
    return tasks.filter((t) => t.type === filter);
  }, [tasks, filter]);
  const columns = COLUMNS_ZH.filter(column =>
    column.id !== "this_week" && column.id !== "waiting" || tasks.some(task => task.status === column.id));

  const computeProgress = (allTasks: any[]) => {
    const countable = allTasks.filter((t) => t.type !== "habit");
    if (countable.length === 0) return 0;
    const totalWeight = countable.reduce((s, t) => s + (t.weight || 1), 0);
    const doneWeight = countable.filter((t) => t.status === "done").reduce((s, t) => s + (t.weight || 1), 0);
    return Math.round((doneWeight / totalWeight) * 100);
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const { draggableId, destination, source } = result;
    const newStatus = destination.droppableId as any;
    const task = tasks.find((t) => t.id === draggableId);
    if (!task) return;
    // Same column same position → no change needed
    if (task.status === newStatus && destination.index === source.index) return;

    const sameColumn = task.status === newStatus;
    const updates: any = sameColumn ? { sort_order: destination.index } : { status: newStatus, sort_order: destination.index };

    updateTask.mutate({ id: task.id, project_id: project.id, ...updates });

    // Re-sort other tasks in the destination column
    const destTasks = filteredTasks
      .filter((t) => t.id !== draggableId && t.status === newStatus)
      .sort((a, b) => a.sort_order - b.sort_order);
    destTasks.splice(destination.index, 0, { id: draggableId } as any);
    destTasks.forEach((t, i) => {
      if (t.id !== draggableId && t.sort_order !== i) {
        updateTask.mutate({ id: t.id, project_id: project.id, sort_order: i });
      }
    });

    if (!sameColumn) {
      const simulatedTasks = tasks.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t));
      const newProgress = computeProgress(simulatedTasks);
      if (newProgress !== project.progress) {
        updateProject.mutate({ id: project.id, progress: newProgress });
      }
    }
  };

  const handleMilestoneToggle = (task: any, done: boolean) => {
    const newStatus = done ? "done" : "todo";
    updateTask.mutate({ id: task.id, project_id: project.id, status: newStatus });
    const simulatedTasks = tasks.map((t) => (t.id === task.id ? { ...t, status: newStatus } : t));
    const newProgress = computeProgress(simulatedTasks);
    if (newProgress !== project.progress) {
      updateProject.mutate({ id: project.id, progress: newProgress });
    }
  };

  const openAddModal = (type: "task" | "habit" | "milestone") => {
    setModalType(type);
    setEditingTask(null);
    setTaskModalOpen(true);
  };

  const openEditModal = (task: any) => {
    setModalType(task.type);
    setEditingTask(task);
    setTaskModalOpen(true);
  };

  const syncProgress = async (nextTasks: Tables<"project_tasks">[]) => {
    const progress = computeProgress(nextTasks);
    if (progress !== project.progress) {
      try {
        await updateProject.mutateAsync({ id: project.id, progress });
      } catch (error) {
        toast({ title: t("工作项已更新，但进度同步失败", "Item updated, but progress sync failed"), description: error instanceof Error ? error.message : String(error), variant: "destructive" });
      }
    }
  };

  const handleSaveTask = async (values: any) => {
    if (saving) return;
    setSaving(true);
    try {
      if (editingTask) {
        await updateTask.mutateAsync({ id: editingTask.id, ...values, project_id: project.id });
        await syncProgress(tasks.map(task => task.id === editingTask.id ? { ...task, ...values } : task));
      } else {
        await createTask.mutateAsync({ ...values, project_id: project.id });
        await syncProgress([...tasks, values]);
      }
      setTaskModalOpen(false);
      setEditingTask(null);
    } catch (error) {
      toast({ title: t("保存失败", "Save failed"), description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!deletingTask || deleting) return;
    setDeleting(true);
    try {
      await deleteTask.mutateAsync({ id: deletingTask.id, project_id: project.id });
      await syncProgress(tasks.filter(task => task.id !== deletingTask.id));
      setDeletingTask(null);
    } catch (error) {
      toast({ title: t("删除失败", "Delete failed"), description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const filters: { key: FilterType; label: string }[] = [
    { key: "all", label: t("全部", "All") },
    { key: "task", label: t("任务", "Tasks") },
    { key: "habit", label: t("习惯", "Habits") },
    { key: "milestone", label: t("里程碑", "Milestones") },
  ];

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex flex-col gap-3 px-5 py-3 bg-card border-b border-border shrink-0">
        <div className="flex items-center justify-between gap-3 min-w-0">
        <div className="flex items-center gap-3 min-w-0">
          <HairlineFigure name={moduleFigure.projects} className="workbench-mark" surface="card" /><h2 className="text-base font-semibold text-foreground truncate">{project.name}</h2>
          {editMode && <ProjectEditActions name={project.name} onEdit={onEditProject} onDelete={onDeleteProject} />}
        </div>
          <Button variant={editMode ? "secondary" : "outline"} className="min-h-11 shrink-0" aria-pressed={editMode} onClick={onToggleEditMode}>
            {editMode ? <Check className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
            {editMode ? t("完成编辑", "Done editing") : t("编辑", "Edit")}
          </Button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 min-w-0">
          {/* Slim progress bar */}
          <div className="flex items-center gap-2">
            <div className="w-24 h-1.5 rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-primary/60 transition-all"
                style={{ width: `${project.progress || 0}%` }}
              />
            </div>
            <span className="text-xs font-medium text-muted-foreground w-8 text-right">{project.progress || 0}%</span>
          </div>
          {/* Filter buttons */}
          <div className="flex items-center gap-0.5 bg-muted rounded-lg p-0.5 shrink-0">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`text-[11px] whitespace-nowrap px-2.5 py-1 rounded-md transition-colors font-medium ${
                  filter === f.key
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
      </div>
      {/* Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden scrollbar-thin px-5 py-3">
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-4 h-full" style={{ minWidth: columns.length > 3 ? columns.length * 240 : undefined }}>
            {columns.map((col) => {
              const colTasks = filteredTasks.filter((t) => t.status === col.id).sort((a, b) => a.sort_order - b.sort_order);
              return (
                <Droppable key={col.id} droppableId={col.id}>
                  {(provided) => (
                    <BoardColumn
                      title={lang === "zh" ? col.title : (COLUMN_TITLE_MAP[col.title] || col.title)}
                      count={colTasks.length}
                      onAdd={() => openAddModal("task")}
                      innerRef={provided.innerRef}
                      placeholder={provided.placeholder}
                      droppableProps={provided.droppableProps}
                    >
                      {colTasks.map((task, index) => (
                        <Draggable key={task.id} draggableId={task.id} index={index} isDragDisabled={editMode}>
                          {(dragProvided) => (
                            <div
                              ref={dragProvided.innerRef}
                              {...dragProvided.draggableProps}
                              {...dragProvided.dragHandleProps}
                              className="mb-2"
                            >
                              {editMode && <ProjectEditActions name={task.title} onEdit={() => openEditModal(task)} onDelete={() => setDeletingTask(task)} />}
                              {task.type === "habit" ? (
                                <HabitCard task={task} projectId={project.id} />
                              ) : task.type === "milestone" ? (
                                <MilestoneCard
                                  task={task}
                                  onToggle={(done) => handleMilestoneToggle(task, done)}
                                  onClick={() => openEditModal(task)}
                                />
                              ) : (
                                <TaskCard task={task} onClick={() => openEditModal(task)} />
                              )}
                            </div>
                          )}
                        </Draggable>
                      ))}
                    </BoardColumn>
                  )}
                </Droppable>
              );
            })}
          </div>
        </DragDropContext>
      </div>
      <TaskModal
        open={taskModalOpen}
        onOpenChange={setTaskModalOpen}
        onSave={handleSaveTask}
        projectId={project.id}
        initial={editingTask}
        defaultType={modalType}
        pending={saving}
      />
      <ProjectDeleteDialog name={deletingTask?.title ?? null} pending={deleting} onCancel={() => setDeletingTask(null)} onConfirm={handleDeleteTask} />
    </div>
  );
}
