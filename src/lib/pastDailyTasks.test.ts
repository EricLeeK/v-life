import { describe, expect, it } from "vitest";
import {
  PAST_DAILY_LOOKBACK_DAYS,
  groupPastDailyTasksByDate,
  selectPastIncompleteDailyTasks,
  shouldCompleteMotherTodo,
} from "./pastDailyTasks";

const today = "2026-09-05";

function row(partial: {
  id: string;
  task_date: string;
  is_completed?: boolean;
  kind?: string;
  archived?: boolean;
}) {
  return {
    id: partial.id,
    task_date: partial.task_date,
    is_completed: partial.is_completed ?? false,
    todos: { kind: partial.kind ?? "once", is_archived: partial.archived ?? false },
  };
}

describe("selectPastIncompleteDailyTasks", () => {
  it("keeps incomplete rows from the last 3 days and drops today, older, and completed", () => {
    const selected = selectPastIncompleteDailyTasks(
      [
        row({ id: "today", task_date: "2026-09-05" }),
        row({ id: "y", task_date: "2026-09-04" }),
        row({ id: "done", task_date: "2026-09-04", is_completed: true }),
        row({ id: "d2", task_date: "2026-09-03" }),
        row({ id: "d3", task_date: "2026-09-02" }),
        row({ id: "old", task_date: "2026-09-01" }),
      ],
      today,
    );
    expect(selected.map((r) => r.id)).toEqual(["y", "d2", "d3"]);
    expect(PAST_DAILY_LOOKBACK_DAYS).toBe(3);
  });

  it("drops archived mother todos", () => {
    const selected = selectPastIncompleteDailyTasks(
      [row({ id: "gone", task_date: "2026-09-04", archived: true })],
      today,
    );
    expect(selected).toEqual([]);
  });
});

describe("groupPastDailyTasksByDate", () => {
  it("groups newest date first with relative labels", () => {
    const groups = groupPastDailyTasksByDate(
      [
        row({ id: "d3", task_date: "2026-09-02" }),
        row({ id: "y", task_date: "2026-09-04" }),
        row({ id: "d2", task_date: "2026-09-03" }),
      ],
      today,
    );
    expect(groups.map((g) => ({ date: g.date, label: g.label, ids: g.tasks.map((t) => t.id) }))).toEqual([
      { date: "2026-09-04", label: "yesterday", ids: ["y"] },
      { date: "2026-09-03", label: "day_before", ids: ["d2"] },
      { date: "2026-09-02", label: "two_days_before", ids: ["d3"] },
    ]);
  });
});

describe("shouldCompleteMotherTodo", () => {
  it("completes one-off todos but not habits or routines", () => {
    expect(shouldCompleteMotherTodo("once")).toBe(true);
    expect(shouldCompleteMotherTodo(null)).toBe(true);
    expect(shouldCompleteMotherTodo("routine")).toBe(false);
    expect(shouldCompleteMotherTodo("habit")).toBe(false);
  });
});
