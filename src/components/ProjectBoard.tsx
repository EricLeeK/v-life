import { Heading, Paragraph } from "@/components/ui/typography";
import { ProjectIcon } from "./projects/ProjectIcon";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";
import { useId } from "react";

import { useState, useMemo, useEffect } from "react";
import { TaskModal, type TaskFormValues } from "./TaskModal";
import { ProjectEditActions } from "./ProjectEditActions";
import { ProjectDeleteDialog } from "./ProjectDeleteDialog";
import { WeightedTaskGrid } from "./projects/WeightedTaskGrid";
import { ProjectWorkCard, type ProjectTask } from "./projects/ProjectWorkCard";
import { projectColumns, byBoardOrder, projectProgress, moveProjectItem } from "./projects/board-model";
import { useProjectBoardMove } from "@/hooks/useProjectBoardMove";
import { CollectionFeedback } from "./concepts/CollectionFeedback";
import { format, parseISO, isValid, differenceInCalendarDays } from "date-fns";
import "./projects/project-board.css";
import { useProjectTasks, useUpdateProjectTask, useUpdateProject, useCreateProjectTask, useDeleteProjectTask } from "@/hooks/useData";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Check, Plus, CalendarDays, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLang } from "@/contexts/LanguageContext";
import type { Tables } from "@/integrations/supabase/types";

const EMPTY_TASKS: ProjectTask[] = [];

type FilterType = "all" | "task" | "habit" | "milestone";

interface ProjectBoardProps {
  project: Tables<"projects">;
  onEditProject: () => void;
  onDeleteProject: () => void;
  editMode: boolean;
  onToggleEditMode: () => void;
}

export function ProjectBoard({ project, onEditProject, onDeleteProject, editMode, onToggleEditMode }: ProjectBoardProps) {
  const { t } = useLang();
  const filterId = useId();
  const reducedMotion = useReducedMotion();
  const { data: serverTasks = EMPTY_TASKS, isLoading, error, refetch } = useProjectTasks(project.id);
  const moveMutation = useProjectBoardMove();
  const [moving, setMoving] = useState(false);
  const updateTask = useUpdateProjectTask();
  const updateProject = useUpdateProject();
  const createTask = useCreateProjectTask();
  const deleteTask = useDeleteProjectTask();
  const { toast } = useToast();
  // Local mirror so drag commits re-order the DOM synchronously (FLIP); any
  // server refresh (refetch) becomes the truth again.
  const [localTasks, setLocalTasks] = useState<Tables<"project_tasks">[] | null>(null);
  useEffect(() => { if (!moving) setLocalTasks(null); }, [serverTasks, moving]);
  const tasks: Tables<"project_tasks">[] = localTasks ?? serverTasks;
  const [filter, setFilter] = useState<FilterType>("all");
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [defaultStatus, setDefaultStatus] = useState("todo");
  const [modalType, setModalType] = useState<"task" | "habit" | "milestone">("task");
  const [editingTask, setEditingTask] = useState<ProjectTask | null>(null);
  const [deletingTask, setDeletingTask] = useState<Tables<"project_tasks"> | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const filteredTasks = useMemo(() => {
    if (filter === "all") return tasks;
    return tasks.filter((t) => t.type === filter);
  }, [tasks, filter]);
  const columns = projectColumns.filter(column => column.id !== "this_week" || tasks.some(task => task.status === "this_week"));
  const computeProgress = projectProgress;
  const progress = projectProgress(tasks);
  const countable = tasks.filter(task => task.type !== "habit");
  const completedCount = countable.filter(task => task.status === "done").length;
  const targetDate = project.target_date ? parseISO(project.target_date) : null;
  const daysLeft = targetDate && isValid(targetDate) ? differenceInCalendarDays(targetDate, new Date()) : null;

  const handleBoardMove = async (id: string, status: string, index: number) => {
    if (moving) return;
    const next = moveProjectItem(tasks, id, status, index, filteredTasks.map(task => task.id));
    if (next.every((task, i) => task.status === tasks[i].status && task.sort_order === tasks[i].sort_order)) return;
    setLocalTasks(next);
    setMoving(true);
    try {
      const order = next.filter(task => task.status === status).sort(byBoardOrder).map(task => task.id);
      await moveMutation.mutateAsync({ projectId: project.id, id, status, order, next });
    } catch (error) {
      setLocalTasks(null);
      toast({ title: t("移动未保存，已恢复原状态", "Move was not saved; original state restored"), description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    } finally { setMoving(false); }
  };

  const handleMilestoneToggle = (task: ProjectTask, done: boolean) => {
    const status = done ? "done" : "todo";
    void handleBoardMove(task.id, status, filteredTasks.filter(item => item.status === status).length);
  };

  const openAddModal = (type: "task" | "habit" | "milestone", status = "todo") => {
    setDefaultStatus(status);
    setModalType(type);
    setEditingTask(null);
    setTaskModalOpen(true);
  };

  const openEditModal = (task: ProjectTask) => {
    setModalType(task.type === "habit" || task.type === "milestone" ? task.type : "task");
    setEditingTask(task);
    setTaskModalOpen(true);
  };

  const syncProgress = async (nextTasks: Pick<ProjectTask, "type"|"status"|"weight">[]) => {
    const progress = computeProgress(nextTasks);
    if (progress !== project.progress) {
      try {
        await updateProject.mutateAsync({ id: project.id, progress });
      } catch (error) {
        toast({ title: t("工作项已更新，但进度同步失败", "Item updated, but progress sync failed"), description: error instanceof Error ? error.message : String(error), variant: "destructive" });
      }
    }
  };

  const handleSaveTask = async (values: TaskFormValues) => {
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
    <div className="project-workspace">
      <header className="project-board-header">
        <div className="project-board-title-row">
          <div className="project-board-title">
            <ProjectIcon name={project.name} svg={project.icon_svg} />
            <Heading as="h2" className="truncate">{project.name}</Heading>
            <span className="project-status-label">{project.status === "active" ? t("进行中", "Active") : project.status === "planning" ? t("规划中", "Planning") : project.status === "paused" ? t("已暂停", "Paused") : t("已结束", "Closed")}</span>
            <span className="project-inline-actions" data-visible={editMode} aria-hidden={!editMode} inert={!editMode}>
              <ProjectEditActions name={project.name} onEdit={onEditProject} onDelete={onDeleteProject} />
            </span>
          </div>
          <div className="project-header-actions flex items-center gap-2 shrink-0">
            <Button variant={editMode ? "secondary" : "ghost"} className="project-mode-toggle min-h-9" aria-pressed={editMode} aria-label={editMode ? t("完成编辑", "Done editing") : t("编辑", "Edit")} aria-disabled={moving} onClick={() => { if (!moving) onToggleEditMode(); }}>
              {editMode ? <Check className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}<span className="project-mode-label" aria-hidden="true"><span style={{visibility:editMode?'hidden':'visible'}}>{t("编辑", "Edit")}</span><span style={{visibility:editMode?'visible':'hidden'}}>{t("完成编辑", "Done editing")}</span></span>
            </Button>
            <Button className="min-h-9" aria-disabled={moving} onClick={() => { if (!moving) openAddModal("task"); }}><Plus className="h-3.5 w-3.5" />{t("新建事项", "New item")}</Button>
          </div>
        </div>
        {project.description && <Paragraph className="project-board-description line-clamp-2">{project.description}</Paragraph>}
        <div className="project-board-summary">
          <div className="project-summary-stats">
            {targetDate && isValid(targetDate) && <span><CalendarDays className="h-3.5 w-3.5" />{format(targetDate,"yyyy/MM/dd")}<span>{daysLeft! < 0 ? t(`逾期 ${-daysLeft!} 天`, `${-daysLeft!} days overdue`) : daysLeft === 0 ? t("今天截止", "Due today") : t(`剩余 ${daysLeft} 天`, `${daysLeft} days left`)}</span></span>}
            <span><CheckCircle2 className="h-3.5 w-3.5 is-complete" /><strong>{completedCount}</strong> / {countable.length} {t("已完成", "done")}</span>
            <span title={t("按任务和里程碑权重计算，习惯不计入", "Weighted tasks and milestones; habits excluded")}><strong>{progress}%</strong> {t("加权进度", "weighted progress")}</span>
          </div>
          <LayoutGroup id={filterId}><div className="project-filters" aria-label={t("筛选工作项", "Filter items")}>{filters.map(f => <button key={f.key} type="button" disabled={moving} aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>{filter === f.key && <motion.span className="project-filter-slider" layoutId="project-filter" transition={reducedMotion ? {duration:0} : {type:"spring",stiffness:420,damping:34}} />}<span className="project-filter-text">{f.label}</span></button>)}</div></LayoutGroup>
        </div>
        <div className="project-distribution" aria-label={t("各状态事项数量分布", "Item distribution by status")}>{columns.map(col => <span key={col.id} data-status={col.id} style={{ flexGrow: filteredTasks.filter(task => task.status === col.id).length || (filteredTasks.length ? 0 : 1), flexBasis: 0 }} />)}</div>
      </header>
      {isLoading || error ? <div className="p-8"><CollectionFeedback loading={isLoading} error={error} retry={refetch}><span /></CollectionFeedback></div> :
        <WeightedTaskGrid items={filteredTasks} columns={columns} disabled={editMode || moving} onMove={handleBoardMove} onAdd={status => openAddModal("task", status)} labelItem={task => task.title}
          renderItem={task => <ProjectWorkCard task={task} disabled={moving} editMode={editMode} onEdit={() => openEditModal(task)} onDelete={() => setDeletingTask(task)} onComplete={done => handleMilestoneToggle(task, done)} />} />}
      <div className="project-save-status" role="status">{moving ? <span className="inline-flex items-center gap-1.5"><Loader2 className="h-3 w-3 animate-spin" />{t("正在保存…", "Saving…")}</span> : t("拖动卡片调整状态 · 里程碑可一键完成 · 习惯独立打卡", "Drag to move · Complete milestones · Check in habits")}</div>
      <TaskModal
        open={taskModalOpen}
        onOpenChange={setTaskModalOpen}
        onSave={handleSaveTask}
        projectId={project.id}
        initial={editingTask}
        defaultType={modalType}
        defaultStatus={defaultStatus}
        pending={saving}
      />
      <ProjectDeleteDialog name={deletingTask?.title ?? null} pending={deleting} onCancel={() => setDeletingTask(null)} onConfirm={handleDeleteTask} />
    </div>
  );
}
