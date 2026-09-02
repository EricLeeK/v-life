export type AiOp = {
  module: string;
  action: string;
  data: Record<string, any>;
};

export type HabitTodoRef = {
  id?: string;
  title?: string;
  kind?: string | null;
  habit_type?: string | null;
  habit_target?: number | null;
};

const HABIT_TYPE_LABEL: Record<string, string> = {
  checkin: "打卡",
  count: "计数",
  duration: "时长",
  avoidance: "克制",
};

export function normalizeHabitCreate(data: Record<string, any>): Record<string, any> {
  const kind = data.kind === "habit" || data.kind === "routine" ? data.kind : data.kind === "once" ? "once" : data.kind || "once";
  const row: Record<string, any> = {
    title: data.title || "未命名待办",
    kind,
    is_paused: data.is_paused === true,
  };
  if (kind === "habit") {
    const habitType = ["checkin", "count", "duration", "avoidance"].includes(data.habit_type)
      ? data.habit_type
      : "checkin";
    row.habit_type = habitType;
    row.category = data.category || "习惯";
    if (habitType === "count") {
      const target = Number(data.habit_target);
      const water = /喝水/.test(String(data.title || ""));
      row.habit_target = target > 0 ? target : water ? 8 : 1;
      row.habit_unit = data.habit_unit || (water ? "杯" : "次");
    } else if (habitType === "duration") {
      const target = Number(data.habit_target);
      row.habit_target = target > 0 ? target : 30;
      row.habit_unit = data.habit_unit || "分钟";
    } else {
      row.habit_target = null;
      row.habit_unit = null;
    }
  } else if (kind === "routine") {
    row.category = data.category || "未分类";
    row.habit_type = null;
    row.habit_target = null;
    row.habit_unit = null;
  }
  return row;
}

export function rewriteCompleteOp(op: AiOp, todo: HabitTodoRef | null | undefined): AiOp {
  if (!todo || op.action !== "update" || op.data?.update?.is_completed !== true) return op;
  if (todo.kind === "habit") {
    const type = todo.habit_type;
    let value = 1;
    if (type === "count" || type === "duration") value = Number(todo.habit_target) || (type === "duration" ? 30 : 1);
    return {
      module: "habit_log",
      action: "create",
      data: { todo_id: todo.id, title: todo.title, value },
    };
  }
  if (todo.kind === "routine") {
    return {
      module: "daily_task",
      action: "create",
      data: { todo_id: todo.id, title: todo.title, complete: true },
    };
  }
  return op;
}

export function shouldSkipDailyTask(todo: { kind?: string | null } | null | undefined): boolean {
  return todo?.kind === "habit";
}

export function formatOpPreview(op: AiOp, actionLabel: string, moduleLabel: string): string {
  const data = op.data || {};
  const title = data.title || data.match?.title || "";
  if (op.module === "todo" && op.action === "create" && data.kind === "habit") {
    const typeLabel = HABIT_TYPE_LABEL[data.habit_type] || "打卡";
    if (data.habit_type === "count" || data.habit_type === "duration") {
      const unit = data.habit_unit ? ` ${data.habit_unit}` : "";
      return `${actionLabel}习惯「${title}」· ${typeLabel} ${data.habit_target}${unit}`;
    }
    return `${actionLabel}习惯「${title}」· ${typeLabel}`;
  }
  if (op.module === "todo" && op.action === "create" && data.kind === "routine") {
    const cat = data.category ? `· 分类 ${data.category}` : "";
    return `${actionLabel}例行「${title}」${cat}（不自动进今日）`;
  }
  if (op.module === "habit_log") {
    return `记录习惯「${title}」今日打卡`;
  }
  return `${actionLabel} ${moduleLabel}「${title}」`;
}
