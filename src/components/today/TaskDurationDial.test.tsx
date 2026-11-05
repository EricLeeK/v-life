import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TaskDurationDial } from "@/components/today/TaskDurationDial";

describe("TaskDurationDial", () => {
  it("selects discrete clock stops while the pointer drags around the face", () => {
    const onChange = vi.fn();
    render(<TaskDurationDial value={30} onChange={onChange} />);
    const face = screen.getByRole("slider", { name: "预计时长" });
    vi.spyOn(face, "getBoundingClientRect").mockReturnValue({
      x: 0, y: 0, left: 0, top: 0, right: 200, bottom: 200, width: 200, height: 200,
      toJSON: () => ({}),
    });

    fireEvent(face, new MouseEvent("pointerdown", { bubbles: true, clientX: 100, clientY: 16 }));
    fireEvent(face, new MouseEvent("pointermove", { bubbles: true, clientX: 49, clientY: 39 }));
    fireEvent(face, new MouseEvent("pointerup", { bubbles: true }));

    expect(onChange).toHaveBeenNthCalledWith(1, 10);
    expect(onChange).toHaveBeenLastCalledWith(240);
  });
});
