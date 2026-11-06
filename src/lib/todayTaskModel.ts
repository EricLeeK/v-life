export const TASK_DURATION_STOPS = [10, 20, 30, 45, 60, 90, 120, 180, 240] as const;

export function hasTaskDuration(minutes: number | null | undefined): minutes is number {
  return typeof minutes === "number" && Number.isFinite(minutes) && minutes > 0;
}

export function formatTaskDuration(minutes: number, lang: "zh" | "en"): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return lang === "zh" ? `${rest} 分钟` : `${rest}m`;
  const hourLabel = lang === "zh" ? `${hours} 小时` : `${hours}h`;
  return rest ? `${hourLabel} ${lang === "zh" ? `${rest} 分钟` : `${rest}m`}` : hourLabel;
}

export function summarizeRemainingTaskTime(
  dailyTasks: { is_completed?: boolean | null; todos?: { estimated_minutes?: number | null } | null }[],
  projectTasks: { status: string; estimated_minutes?: number | null }[],
) {
  const remaining = [
    ...dailyTasks.filter((task) => !task.is_completed).map((task) => task.todos?.estimated_minutes),
    ...projectTasks.filter((task) => task.status !== "done").map((task) => task.estimated_minutes),
  ];
  return {
    remainingMinutes: remaining.reduce<number>((sum, minutes) => sum + (hasTaskDuration(minutes) ? minutes : 0), 0),
    remainingCount: remaining.length,
    unestimatedCount: remaining.filter((minutes) => !hasTaskDuration(minutes)).length,
  };
}

export interface TodayTaskDateFields {
  origin_task_date?: string | null;
  task_date?: string | null;
  created_at?: string | null;
}

export interface DailyTaskMoveRow extends TodayTaskDateFields {
  id: string;
  todo_id: string;
  task_date: string;
  is_completed?: boolean | null;
}

export function planDailyTaskMove<T extends DailyTaskMoveRow>(source: T | undefined, rows: T[], targetDate: string) {
  if (!source || source.is_completed) throw new Error("Task unavailable");
  if (source.task_date === targetDate) return { kind: "unchanged" as const, target: source };
  const target = rows.find((row) => row.todo_id === source.todo_id && row.task_date === targetDate);
  if (target?.is_completed) throw new Error("Target task is already completed");
  const originDate = source.origin_task_date || source.task_date;
  return target
    ? { kind: "existing_target" as const, target, originDate }
    : { kind: "create" as const, originDate };
}

export function getTaskDisplayDate(task: TodayTaskDateFields): string | null {
  return task.origin_task_date || task.task_date || task.created_at?.slice(0, 10) || null;
}

export function formatTaskDateLabel(date: string | null | undefined): string {
  if (!date) return "";
  const datePart = date.slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  return match ? `${match[2]}-${match[3]}` : "";
}

export function stepTaskDuration(value: number, delta: number): number {
  const currentIndex = TASK_DURATION_STOPS.reduce((best, stop, index) =>
    Math.abs(stop - value) < Math.abs(TASK_DURATION_STOPS[best] - value) ? index : best, 0);
  const nextIndex = Math.max(0, Math.min(TASK_DURATION_STOPS.length - 1, currentIndex + delta));
  return TASK_DURATION_STOPS[nextIndex];
}

export function sortTasksCompletedLast<T extends { is_completed?: boolean | null }>(tasks: T[]): T[] {
  return [...tasks].sort((a, b) => Number(Boolean(a.is_completed)) - Number(Boolean(b.is_completed)));
}

export function orderTodayTaskGroups<
  TGroup extends { tasks: TTask[] },
  TTask extends { is_completed?: boolean | null },
>(groups: TGroup[]): TGroup[] {
  return groups
    .map((group, index) => ({
      group: { ...group, tasks: sortTasksCompletedLast(group.tasks) },
      index,
      complete: group.tasks.length > 0 && group.tasks.every((task) => Boolean(task.is_completed)),
    }))
    .sort((a, b) => Number(a.complete) - Number(b.complete) || a.index - b.index)
    .map(({ group }) => group);
}

export function orderTodayTaskSections<
  TGroup extends { tasks: TTask[] },
  TTask extends { is_completed?: boolean | null },
>(groups: TGroup[], standaloneTasks: TTask[]) {
  const orderedGroups = orderTodayTaskGroups(groups);
  const activeGroups = orderedGroups.filter((group) => group.tasks.some((task) => !task.is_completed));
  const completedGroups = orderedGroups.filter((group) => group.tasks.length > 0 && group.tasks.every((task) => Boolean(task.is_completed)));
  const orderedStandaloneTasks = sortTasksCompletedLast(standaloneTasks);
  return {
    activeGroups,
    activeTasks: orderedStandaloneTasks.filter((task) => !task.is_completed),
    completedGroups,
    completedTasks: orderedStandaloneTasks.filter((task) => Boolean(task.is_completed)),
  };
}
