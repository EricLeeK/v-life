import { useState, useMemo } from "react";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BoardColumn } from "./BoardColumn";
import { TaskCard } from "./TaskCard";
import { HabitCard } from "./HabitCard";
import { MilestoneCard } from "./MilestoneCard";
import { TaskModal } from "./TaskModal";
import { useProjectTasks, useUpdateProjectTask, useUpdateProject, useCreateProjectTask } from "@/hooks/useData";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLang } from "@/contexts/LanguageContext";

const COLUMNS_ZH = [
  { id: "todo", title: "待办" },
  { id: "this_week", title: "本周" },
  { id: "in_progress", title: "进行中" },
  { id: "waiting", title: "等待中" },
  { id: "done", title: "已完成" },
] as const;
const COLUMN_TITLE_MAP: Record<string, string> = {
  "待办": "To Do", "本周": "This Week", "进行中": "In Progress",
  "等待中": "Waiting", "已完成": "Done",
};

type FilterType = "all" | "task" | "habit" | "milestone";

interface ProjectBoardProps {
  project: any;
  onEditProject: () => void;
}

export function ProjectBoard({ project, onEditProject }: ProjectBoardProps) {
  const { t, lang } = useLang();
  const { data: tasks = [] } = useProjectTasks(project.id);
  const updateTask = useUpdateProjectTask();
  const updateProject = useUpdateProject();
  const createTask = useCreateProjectTask();
  const [filter, setFilter] = useState<FilterType>("all");
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [modalType, setModalType] = useState<"task" | "habit" | "milestone">("task");
  const [editingTask, setEditingTask] = useState<any>(null);

  const filteredTasks = useMemo(() => {
    if (filter === "all") return tasks;
    return tasks.filter((t) => t.type === filter);
  }, [tasks, filter]);

  // 计算并更新项目进度
  const computeProgress = (allTasks: any[]) => {
    const countable = allTasks.filter((t) => t.type !== "habit");
    if (countable.length === 0) return 0;
    const totalWeight = countable.reduce((s, t) => s + (t.weight || 1), 0);
    const doneWeight = countable.filter((t) => t.status === "done").reduce((s, t) => s + (t.weight || 1), 0);
    return Math.round((doneWeight / totalWeight) * 100);
  };

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    const { draggableId, destination } = result;
    const newStatus = destination.droppableId as any;
    const task = tasks.find((t) => t.id === draggableId);
    if (!task || task.status === newStatus) return;

    const updates: any = { status: newStatus };

    // 乐观更新本地顺序
    updateTask.mutate({ id: task.id, project_id: project.id, ...updates });

    // 检查进度变化
    const simulatedTasks = tasks.map((t) => (t.id === task.id ? { ...t, ...updates } : t));
    const newProgress = computeProgress(simulatedTasks);
    if (newProgress !== project.progress) {
      updateProject.mutate({ id: project.id, progress: newProgress });
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

  const handleSaveTask = (values: any) => {
    if (editingTask) {
      updateTask.mutate({ id: editingTask.id, project_id: project.id, ...values });
    } else {
      createTask.mutate({ ...values, project_id: project.id }, {
        onSuccess: () => {
          // 创建后重新计算进度（如果习惯则不影响）
          const newTasks = [...tasks, { ...values, id: "temp" }];
          const newProgress = computeProgress(newTasks);
          if (newProgress !== project.progress) {
            updateProject.mutate({ id: project.id, progress: newProgress });
          }
        },
      });
    }
    setTaskModalOpen(false);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-4 min-w-0">
          <h2 className="text-lg font-semibold truncate">{project.name}</h2>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onEditProject}>
            <Settings2 className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-4">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as FilterType)}>
            <TabsList className="h-8">
              <TabsTrigger value="all" className="text-xs px-2">{t("全部","All")}</TabsTrigger>
              <TabsTrigger value="task" className="text-xs px-2">{t("任务","Tasks")}</TabsTrigger>
              <TabsTrigger value="habit" className="text-xs px-2">{t("习惯","Habits")}</TabsTrigger>
              <TabsTrigger value="milestone" className="text-xs px-2">{t("里程碑","Milestones")}</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>
      <div className="px-4 py-2 shrink-0">
        <div className="flex items-center gap-3">
          <Progress value={project.progress} className="h-2 flex-1" />
          <span className="text-sm font-medium w-10 text-right">{project.progress}%</span>
        </div>
      </div>
      <div className="flex-1 overflow-x-auto overflow-y-hidden px-4 py-2">
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-4 h-full min-w-max">
            {COLUMNS_ZH.map((col) => {
              const colTasks = filteredTasks.filter((t) => t.status === col.id);
              return (
                <Droppable key={col.id} droppableId={col.id}>
                  {(provided) => (
                    <div ref={provided.innerRef} {...provided.droppableProps} className="h-full">
                      <BoardColumn
                        title={lang === "zh" ? col.title : (COLUMN_TITLE_MAP[col.title] || col.title)}
                        count={colTasks.length}
                        onAdd={() => openAddModal("task")}
                      >
                        {colTasks.map((task, index) => (
                          <Draggable key={task.id} draggableId={task.id} index={index}>
                            {(dragProvided) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                                className="mb-2"
                              >
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
                        {provided.placeholder}
                      </BoardColumn>
                    </div>
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
      />
    </div>
  );
}
