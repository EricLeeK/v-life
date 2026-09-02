import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LangProvider } from "@/contexts/LanguageContext";
import { HabitWidgetStack } from "./HabitWidgetStack";

function renderStack(onChange = vi.fn()) {
  return {
    onChange,
    ...render(
      <LangProvider>
        <HabitWidgetStack
          today="2026-09-02"
          onChange={onChange}
          habits={[
            { id: "h1", title: "晨间冥想", habit_type: "checkin", created_at: "2026-08-20" },
            { id: "h2", title: "喝水", habit_type: "count", habit_target: 8, habit_unit: "杯" },
            { id: "h3", title: "23:30 前睡觉", habit_type: "avoidance", created_at: "2026-08-26" },
          ]}
          logs={[{ todo_id: "h2", log_date: "2026-09-02", value: 5, broken: false }]}
        />
      </LangProvider>,
    ),
  };
}

describe("HabitWidgetStack", () => {
  it("renders nothing when there are no habits", () => {
    const { container } = render(
      <LangProvider>
        <HabitWidgetStack habits={[]} logs={[]} today="2026-09-02" onChange={vi.fn()} />
      </LangProvider>,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("shows habit names and check-in control without a checkbox", () => {
    renderStack();
    expect(screen.getByText("晨间冥想")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "今日打卡" })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("increments a count habit", () => {
    const { onChange } = renderStack();
    fireEvent.click(screen.getByRole("button", { name: "增加" }));
    expect(onChange).toHaveBeenCalledWith("h2", { value: 6 });
  });

  it("logs avoidance as a positive persist, not a break", () => {
    const { onChange } = renderStack();
    expect(screen.queryByRole("button", { name: "破功" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "继续坚持" }));
    expect(onChange).toHaveBeenCalledWith("h3", { value: 1 });
  });
});
