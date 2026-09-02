export const TODO_KINDS = ["once", "routine", "habit"] as const;
export type TodoKind = (typeof TODO_KINDS)[number];

export const HABIT_TYPES = ["checkin", "count", "duration", "avoidance"] as const;
export type HabitType = (typeof HABIT_TYPES)[number];

export type HabitLike = {
  habit_type?: string | null;
  habit_target?: number | null;
};

export type HabitLogLike = {
  log_date?: string;
  value?: number | null;
  broken?: boolean | null;
};

export type TodoLike = {
  id: string;
  kind?: string | null;
  is_archived?: boolean | null;
  is_paused?: boolean | null;
  is_completed?: boolean | null;
};

export function isPersistentKind(kind?: string | null): boolean {
  return kind === "habit" || kind === "routine";
}

export function isHabitMetToday(habit: HabitLike, log: HabitLogLike | null | undefined): boolean {
  if (!log || log.broken) return false;
  const type = habit.habit_type;
  const value = Number(log.value) || 0;
  if (type === "checkin" || type === "avoidance") return value >= 1;
  const target = Number(habit.habit_target) || 0;
  if (type === "count" || type === "duration") return target > 0 && value >= target;
  return false;
}

function logByDate(logs: HabitLogLike[], date: string): HabitLogLike | undefined {
  return logs.find((l) => l.log_date === date);
}

export function addIsoDays(iso: string, delta: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function mondayOf(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const day = dt.getDay();
  const diff = day === 0 ? 6 : day - 1;
  dt.setDate(dt.getDate() - diff);
  const yyyy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function logForDay(logs: HabitLogLike[], date: string): HabitLogLike | null | undefined {
  return logByDate(logs, date) ?? null;
}

export function habitStreak(habit: HabitLike, logs: HabitLogLike[], today: string, since?: string): number {
  const metOn = (date: string) => isHabitMetToday(habit, logForDay(logs, date));
  const start = metOn(today) ? today : addIsoDays(today, -1);
  if (since && start < since) return 0;
  if (!metOn(start)) return 0;
  let streak = 0;
  let cursor = start;
  while (metOn(cursor)) {
    streak += 1;
    const prev = addIsoDays(cursor, -1);
    if (since && prev < since) break;
    cursor = prev;
  }
  return streak;
}

export function weekCheckins(habit: HabitLike, logs: HabitLogLike[], today: string): number {
  const monday = mondayOf(today);
  let count = 0;
  let cursor = monday;
  while (cursor <= today) {
    if (isHabitMetToday(habit, logForDay(logs, cursor))) count += 1;
    cursor = addIsoDays(cursor, 1);
  }
  return count;
}

export function habitGroupFirst<T extends TodoLike>(todos: T[]): T[] {
  const habits: T[] = [];
  const rest: T[] = [];
  for (const todo of todos) {
    if (todo.kind === "habit" && !todo.is_archived) habits.push(todo);
    else rest.push(todo);
  }
  return [...habits, ...rest];
}

export function todayPickerItems<T extends TodoLike>(todos: T[], todayTodoIds: Set<string>): T[] {
  const eligible = todos.filter((todo) => {
    if (todo.kind === "habit") return false;
    if (todo.is_archived || todo.is_paused || todo.is_completed) return false;
    if (todayTodoIds.has(todo.id)) return false;
    return true;
  });
  const routines = eligible.filter((t) => t.kind === "routine");
  const rest = eligible.filter((t) => t.kind !== "routine");
  return [...routines, ...rest];
}
