import { useState, useMemo } from "react";
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
  { id: "in_progress", title: "进行中" },
  { id: "done", title: "已完成" },
] as const;
const COLUMN_TITLE_MAP: Record<string, string> = {
  "待办": "To Do", "进行中": "In Progress", "已完成": "Done",
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

  const handleSaveTask = (values: any) => {
    if (editingTask) {
      updateTask.mutate({ id: editingTask.id, project_id: project.id, ...values });
    } else {
      createTask.mutate({ ...values, project_id: project.id }, {
        onSuccess: () => {
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

  const filters: { key: FilterType; label: string }[] = [
    { key: "all", label: t("全部", "All") },
    { key: "task", label: t("任务", "Tasks") },
    { key: "habit", label: t("习惯", "Habits") },
    { key: "milestone", label: t("里程碑", "Milestones") },
  ];

  return (
    <div className="flex flex-col h-full bg-[#f4f3ee]">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 bg-white border-b border-[#e4e1d7] shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <h2 className="text-base font-semibold text-[#1f1a14] truncate">{project.name}</h2>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-[#8a847a] hover:text-[#1f1a14]" onClick={onEditProject}>
            <Settings2 className="h-3.5 w-3.5" />
          </Button>
        </div>
        <div className="flex items-center gap-3">
          {/* Slim progress bar */}
          <div className="flex items-center gap-2">
            <div className="w-24 h-1.5 rounded-full bg-[#e4e1d7]">
              <div
                className="h-full rounded-full bg-[#1f1a14]/40 transition-all"
                style={{ width: `${project.progress || 0}%` }}
              />
            </div>
            <span className="text-xs font-medium text-[#8a847a] w-8 text-right">{project.progress || 0}%</span>
          </div>
          {/* Filter buttons */}
          <div className="flex items-center gap-0.5 bg-[#f4f3ee] rounded-lg p-0.5">
            {filters.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`text-[11px] px-2.5 py-1 rounded-md transition-colors font-medium ${
                  filter === f.key
                    ? "bg-white text-[#1f1a14] shadow-sm"
                    : "text-[#8a847a] hover:text-[#1f1a14]"
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
          <div className="flex gap-4 h-full">
            {COLUMNS_ZH.map((col) => {
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
      />
    </div>
  );
}
