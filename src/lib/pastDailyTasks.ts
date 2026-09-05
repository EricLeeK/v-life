import { addIsoDays, isPersistentKind } from "./habits";

export const PAST_DAILY_LOOKBACK_DAYS = 3;

export type PastDateLabel = "yesterday" | "day_before" | "two_days_before";

export const PAST_DATE_LABELS: Record<PastDateLabel, { zh: string; en: string }> = {
  yesterday: { zh: "昨天", en: "Yesterday" },
  day_before: { zh: "前天", en: "2 days ago" },
  two_days_before: { zh: "大前天", en: "3 days ago" },
};

export type DailyTaskLike = {
  id: string;
  task_date: string;
  is_completed?: boolean | null;
  todos?: { kind?: string | null; is_archived?: boolean | null } | null;
};

export function shouldCompleteMotherTodo(kind?: string | null): boolean {
  return !isPersistentKind(kind);
}

export function selectPastIncompleteDailyTasks<T extends DailyTaskLike>(
  rows: T[],
  today: string,
  lookbackDays: number = PAST_DAILY_LOOKBACK_DAYS,
): T[] {
  const oldest = addIsoDays(today, -lookbackDays);
  return rows.filter((row) => {
    if (row.is_completed) return false;
    if (row.todos?.is_archived) return false;
    if (row.task_date >= today) return false;
    if (row.task_date < oldest) return false;
    return true;
  });
}

export function pastDateLabel(taskDate: string, today: string): PastDateLabel {
  if (taskDate === addIsoDays(today, -1)) return "yesterday";
  if (taskDate === addIsoDays(today, -2)) return "day_before";
  return "two_days_before";
}

export function groupPastDailyTasksByDate<T extends DailyTaskLike>(
  rows: T[],
  today: string,
): Array<{ date: string; label: PastDateLabel; tasks: T[] }> {
  const byDate = new Map<string, T[]>();
  for (const row of rows) {
    const list = byDate.get(row.task_date) ?? [];
    list.push(row);
    byDate.set(row.task_date, list);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? 1 : a > b ? -1 : 0))
    .map(([date, tasks]) => ({
      date,
      label: pastDateLabel(date, today),
      tasks,
    }));
}
