import { describe, expect, it } from "vitest";
import {
  TASK_DURATION_STOPS,
  formatTaskDateLabel,
  getTaskDisplayDate,
  orderTodayTaskSections,
  planDailyTaskMove,
  stepTaskDuration,
  formatTaskDuration,
  summarizeRemainingTaskTime,
} from "@/lib/todayTaskModel";

describe("remaining task time", () => {
  it("sums only unfinished daily and project tasks, keeping unknown estimates separate", () => {
    expect(summarizeRemainingTaskTime([
      { is_completed: false, todos: { estimated_minutes: 45 } },
      { is_completed: true, todos: { estimated_minutes: 120 } },
      { is_completed: false, todos: { estimated_minutes: null } },
      { is_completed: false, todos: null },
    ], [
      { status: "doing", estimated_minutes: 90 },
      { status: "done", estimated_minutes: 240 },
      { status: "todo", estimated_minutes: 30 },
    ])).toEqual({ remainingMinutes: 165, remainingCount: 5, unestimatedCount: 2 });
  });

  it("does not turn invalid or missing estimates into an invented duration", () => {
    expect(summarizeRemainingTaskTime([], [
      { status: "todo", estimated_minutes: 0 },
      { status: "todo", estimated_minutes: -20 },
      { status: "todo", estimated_minutes: Number.NaN },
      { status: "todo", estimated_minutes: Number.POSITIVE_INFINITY },
      { status: "todo" },
    ])).toEqual({ remainingMinutes: 0, remainingCount: 5, unestimatedCount: 5 });
    expect(summarizeRemainingTaskTime([], [])).toEqual({ remainingMinutes: 0, remainingCount: 0, unestimatedCount: 0 });
  });

  it("formats hours and minutes exactly, including totals longer than a day", () => {
    expect(formatTaskDuration(45, "zh")).toBe("45 分钟");
    expect(formatTaskDuration(60, "zh")).toBe("1 小时");
    expect(formatTaskDuration(135, "zh")).toBe("2 小时 15 分钟");
    expect(formatTaskDuration(1530, "zh")).toBe("25 小时 30 分钟");
    expect(formatTaskDuration(135, "en")).toBe("2h 15m");
    expect(formatTaskDuration(0, "en")).toBe("0m");
  });
});

describe("today task ordering", () => {
  it("puts completed groups and standalone rows after every incomplete item", () => {
    const groups = [
      { id: "finished", tasks: [{ id: "f1", is_completed: true }, { id: "f2", is_completed: true }] },
      { id: "active", tasks: [{ id: "a1", is_completed: true }, { id: "a2", is_completed: false }] },
    ];
    const standalone = [
      { id: "done", is_completed: true },
      { id: "open", is_completed: false },
    ];

    const sections = orderTodayTaskSections(groups, standalone);

    expect(sections.activeGroups.map((group) => group.id)).toEqual(["active"]);
    expect(sections.activeGroups[0].tasks.map((task) => task.id)).toEqual(["a2", "a1"]);
    expect(sections.activeTasks.map((task) => task.id)).toEqual(["open"]);
    expect(sections.completedGroups.map((group) => group.id)).toEqual(["finished"]);
    expect(sections.completedTasks.map((task) => task.id)).toEqual(["done"]);
  });
});

describe("today task display metadata", () => {
  it("keeps the original planned date as the displayed date after a reschedule", () => {
    const shownDate = getTaskDisplayDate({
      origin_task_date: "2026-11-03",
      task_date: "2026-11-04",
      created_at: "2026-11-01T09:30:00.000Z",
    });
    expect(shownDate).toBe("2026-11-03");
    expect(formatTaskDateLabel(shownDate)).toBe("11-03");
  });

  it("falls back to the current plan date for tasks without an origin date", () => {
    expect(getTaskDisplayDate({ task_date: "2026-11-03" })).toBe("2026-11-03");
  });

  it("uses the requested discrete duration stops and clamps keyboard steps", () => {
    expect(TASK_DURATION_STOPS).toEqual([10, 20, 30, 45, 60, 90, 120, 180, 240]);
    expect(stepTaskDuration(30, 1)).toBe(45);
    expect(stepTaskDuration(10, -1)).toBe(10);
    expect(stepTaskDuration(240, 1)).toBe(240);
  });

  it("keeps an already-today item intact and carries its date when merging into an existing target", () => {
    const source = { id: "source", todo_id: "todo", task_date: "2026-11-03", origin_task_date: "2026-11-03", is_completed: false };
    const unchanged = planDailyTaskMove(source, [source], "2026-11-03");
    expect(unchanged).toEqual({ kind: "unchanged", target: source });

    const target = { id: "target", todo_id: "todo", task_date: "2026-11-04", origin_task_date: "2026-11-04", is_completed: false };
    expect(planDailyTaskMove(source, [source, target], "2026-11-04")).toEqual({
      kind: "existing_target",
      target,
      originDate: "2026-11-03",
    });
  });

  it("refuses to move a task onto a completed target row", () => {
    const source = { id: "source", todo_id: "todo", task_date: "2026-11-03", is_completed: false };
    const target = { id: "target", todo_id: "todo", task_date: "2026-11-04", is_completed: true };
    expect(() => planDailyTaskMove(source, [source, target], "2026-11-04")).toThrow("Target task is already completed");
  });
});
