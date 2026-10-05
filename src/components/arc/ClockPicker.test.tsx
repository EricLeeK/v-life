import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ClockPicker } from "./ClockPicker";

const text = { placeholder: "--:--", hour: "小时", minute: "分钟", now: "现在", clear: "清除", cancel: "取消", done: "完成" };

describe("ClockPicker", () => {
  it("sets hours then minutes from the keyboard and commits HH:mm", () => {
    const onChange = vi.fn();
    render(<ClockPicker label="开始时间" value="09:30" onChange={onChange} text={text} />);

    fireEvent.click(screen.getByRole("button", { name: "开始时间: 09:30" }));
    const face = screen.getByRole("slider", { name: "小时" });
    expect(face).toHaveAttribute("aria-valuenow", "9");

    fireEvent.keyDown(face, { key: "ArrowUp" });
    fireEvent.keyDown(face, { key: "ArrowUp" });
    fireEvent.keyDown(face, { key: "Enter" });

    const minutes = screen.getByRole("slider", { name: "分钟" });
    fireEvent.keyDown(minutes, { key: "PageUp" });
    fireEvent.keyDown(minutes, { key: "ArrowDown" });
    fireEvent.keyDown(minutes, { key: "Enter" });

    expect(onChange).toHaveBeenCalledWith("11:34");
  });

  it("wraps past midnight and clears only when allowed", () => {
    const onChange = vi.fn();
    render(<ClockPicker label="时间" value="00:05" onChange={onChange} text={text} clearable />);

    fireEvent.click(screen.getByRole("button", { name: "时间: 00:05" }));
    fireEvent.keyDown(screen.getByRole("slider", { name: "小时" }), { key: "ArrowDown" });
    expect(screen.getByRole("slider", { name: "小时" })).toHaveAttribute("aria-valuenow", "23");

    fireEvent.click(screen.getByRole("button", { name: "清除" }));
    expect(onChange).toHaveBeenCalledWith("");
  });
});
