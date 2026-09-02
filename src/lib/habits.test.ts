import { describe, expect, it } from "vitest";
import {
  habitGroupFirst,
  habitStreak,
  isHabitMetToday,
  isPersistentKind,
  todayPickerItems,
  weekCheckins,
} from "./habits";

const checkin = { kind: "habit", habit_type: "checkin" as const, habit_target: null };
const water = { kind: "habit", habit_type: "count" as const, habit_target: 8 };
const read = { kind: "habit", habit_type: "duration" as const, habit_target: 30 };
const sleep = { kind: "habit", habit_type: "avoidance" as const, habit_target: null };

describe("isPersistentKind", () => {
  it("treats habit and routine as persistent", () => {
    expect(isPersistentKind("habit")).toBe(true);
    expect(isPersistentKind("routine")).toBe(true);
    expect(isPersistentKind("once")).toBe(false);
    expect(isPersistentKind(undefined)).toBe(false);
  });
});

describe("isHabitMetToday", () => {
  it("marks checkin done at value 1", () => {
    expect(isHabitMetToday(checkin, { value: 1, broken: false })).toBe(true);
    expect(isHabitMetToday(checkin, null)).toBe(false);
  });

  it("marks count and duration done at target", () => {
    expect(isHabitMetToday(water, { value: 8 })).toBe(true);
    expect(isHabitMetToday(water, { value: 5 })).toBe(false);
    expect(isHabitMetToday(read, { value: 30 })).toBe(true);
    expect(isHabitMetToday(read, { value: 18 })).toBe(false);
  });

  it("treats avoidance like a check-in: only met after a persist log", () => {
    expect(isHabitMetToday(sleep, null)).toBe(false);
    expect(isHabitMetToday(sleep, { value: 1, broken: false })).toBe(true);
    expect(isHabitMetToday(sleep, { broken: true })).toBe(false);
  });
});

describe("habitStreak", () => {
  it("counts consecutive met days ending today or yesterday", () => {
    const logs = [
      { log_date: "2026-09-02", value: 1 },
      { log_date: "2026-09-01", value: 1 },
      { log_date: "2026-08-31", value: 1 },
    ];
    expect(habitStreak(checkin, logs, "2026-09-02")).toBe(3);
  });

  it("keeps yesterday streak when today is not yet done", () => {
    const logs = [
      { log_date: "2026-09-01", value: 1 },
      { log_date: "2026-08-31", value: 1 },
    ];
    expect(habitStreak(checkin, logs, "2026-09-02")).toBe(2);
  });

  it("breaks when a gap appears", () => {
    const logs = [
      { log_date: "2026-09-02", value: 1 },
      { log_date: "2026-08-30", value: 1 },
    ];
    expect(habitStreak(checkin, logs, "2026-09-02")).toBe(1);
  });

  it("counts avoidance streak from persist logs, not from created date", () => {
    expect(habitStreak(sleep, [], "2026-09-02", "2026-08-26")).toBe(0);
    expect(
      habitStreak(
        sleep,
        [
          { log_date: "2026-09-02", value: 1 },
          { log_date: "2026-09-01", value: 1 },
        ],
        "2026-09-02",
        "2026-08-26",
      ),
    ).toBe(2);
  });
});

describe("weekCheckins", () => {
  it("counts met days from Monday through today", () => {
    const logs = [
      { log_date: "2026-08-31", value: 1 },
      { log_date: "2026-09-01", value: 1 },
      { log_date: "2026-09-02", value: 1 },
    ];
    expect(weekCheckins(checkin, logs, "2026-09-02")).toBe(3);
  });
});

describe("habitGroupFirst", () => {
  it("pins unarchived habits to the front", () => {
    const todos = [
      { id: "a", kind: "once", is_archived: false },
      { id: "b", kind: "habit", is_archived: false },
      { id: "c", kind: "routine", is_archived: false },
      { id: "d", kind: "habit", is_archived: true },
    ];
    expect(habitGroupFirst(todos).map((t) => t.id)).toEqual(["b", "a", "c", "d"]);
  });
});

describe("todayPickerItems", () => {
  it("hides habits, puts routines first, and drops items already on today", () => {
    const todos = [
      { id: "once-1", kind: "once", is_archived: false, is_paused: false, is_completed: false },
      { id: "habit-1", kind: "habit", is_archived: false, is_paused: false, is_completed: false },
      { id: "routine-1", kind: "routine", is_archived: false, is_paused: false, is_completed: false },
      { id: "routine-2", kind: "routine", is_archived: false, is_paused: true, is_completed: false },
      { id: "once-2", kind: "once", is_archived: false, is_paused: false, is_completed: false },
    ];
    const items = todayPickerItems(todos, new Set(["once-2"]));
    expect(items.map((t) => t.id)).toEqual(["routine-1", "once-1"]);
  });
});
