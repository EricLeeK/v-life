import { describe, expect, it } from "vitest";
import {
  formatOpPreview,
  normalizeHabitCreate,
  rewriteCompleteOp,
  shouldSkipDailyTask,
} from "./habitAi";

describe("normalizeHabitCreate", () => {
  it("defaults habit type to checkin and category to 习惯", () => {
    expect(normalizeHabitCreate({ title: "早起", kind: "habit" })).toEqual(
      expect.objectContaining({
        title: "早起",
        kind: "habit",
        habit_type: "checkin",
        category: "习惯",
        is_paused: false,
      }),
    );
  });

  it("defaults count target to 1 and duration target to 30", () => {
    expect(normalizeHabitCreate({ title: "俯卧撑", kind: "habit", habit_type: "count" }).habit_target).toBe(1);
    expect(normalizeHabitCreate({ title: "阅读", kind: "habit", habit_type: "duration" }).habit_target).toBe(30);
    expect(normalizeHabitCreate({ title: "喝水", kind: "habit", habit_type: "count", habit_target: 8 }).habit_target).toBe(8);
    expect(normalizeHabitCreate({ title: "喝水", kind: "habit", habit_type: "count" })).toEqual(
      expect.objectContaining({ habit_target: 8, habit_unit: "杯" }),
    );
  });

  it("does not force 习惯 category on routines", () => {
    expect(normalizeHabitCreate({ title: "查邮箱", kind: "routine", category: "工作" }).category).toBe("工作");
  });
});

describe("rewriteCompleteOp", () => {
  it("turns habit is_completed into a habit_log", () => {
    const rewritten = rewriteCompleteOp(
      { module: "todo", action: "update", data: { match: { title: "冥想" }, update: { is_completed: true } } },
      { id: "h1", title: "冥想", kind: "habit", habit_type: "checkin", habit_target: null },
    );
    expect(rewritten).toEqual({
      module: "habit_log",
      action: "create",
      data: { todo_id: "h1", title: "冥想", value: 1 },
    });
  });

  it("uses habit target for count and duration", () => {
    const rewritten = rewriteCompleteOp(
      { module: "todo", action: "update", data: { match: { title: "喝水" }, update: { is_completed: true } } },
      { id: "h2", title: "喝水", kind: "habit", habit_type: "count", habit_target: 8 },
    );
    expect(rewritten.data.value).toBe(8);
  });

  it("marks routine complete as needing a daily task instead of the master card", () => {
    const rewritten = rewriteCompleteOp(
      { module: "todo", action: "update", data: { match: { title: "查邮箱" }, update: { is_completed: true } } },
      { id: "r1", title: "查邮箱", kind: "routine" },
    );
    expect(rewritten).toEqual({
      module: "daily_task",
      action: "create",
      data: { todo_id: "r1", title: "查邮箱", complete: true },
    });
  });
});

describe("shouldSkipDailyTask", () => {
  it("skips habits only", () => {
    expect(shouldSkipDailyTask({ kind: "habit" })).toBe(true);
    expect(shouldSkipDailyTask({ kind: "routine" })).toBe(false);
    expect(shouldSkipDailyTask({ kind: "once" })).toBe(false);
  });
});

describe("formatOpPreview", () => {
  it("describes habit and routine creates in one line", () => {
    expect(
      formatOpPreview(
        { module: "todo", action: "create", data: { title: "喝水", kind: "habit", habit_type: "count", habit_target: 8, habit_unit: "杯" } },
        "新增",
        "待办",
      ),
    ).toBe("新增习惯「喝水」· 计数 8 杯");
    expect(
      formatOpPreview(
        { module: "todo", action: "create", data: { title: "查工作邮箱", kind: "routine", category: "工作" } },
        "新增",
        "待办",
      ),
    ).toBe("新增例行「查工作邮箱」· 分类 工作（不自动进今日）");
  });
});
