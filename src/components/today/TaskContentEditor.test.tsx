import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TaskContentEditor } from "@/components/today/TaskContentEditor";

describe("TaskContentEditor", () => {
  it("edits a task's title, detail, and estimated duration as one repository update", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <TaskContentEditor
        item={{ id: "todo-1", title: "Read notes", detail: "Chapter 2", estimated_minutes: 30 }}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Read notes" }));
    fireEvent.change(await screen.findByLabelText("任务标题"), { target: { value: "Review notes" } });
    fireEvent.change(screen.getByLabelText("详情"), { target: { value: "Chapters 2 and 3" } });
    fireEvent.keyDown(screen.getByRole("slider", { name: "预计时长" }), { key: "ArrowRight" });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith({
      title: "Review notes",
      detail: "Chapters 2 and 3",
      estimated_minutes: 45,
    }));
  });

  it("does not submit a blank task title", async () => {
    const onSave = vi.fn();
    render(<TaskContentEditor item={{ id: "todo-2", title: "Task", detail: null }} onSave={onSave} />);

    fireEvent.click(screen.getByRole("button", { name: "Task" }));
    fireEvent.change(await screen.findByLabelText("任务标题"), { target: { value: "   " } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByText("请填写任务标题")).toBeInTheDocument();
  });

  it("keeps the draft open and reports an update failure", async () => {
    const onSave = vi.fn().mockRejectedValue(new Error("offline"));
    render(<TaskContentEditor item={{ id: "todo-3", title: "Draft", detail: null }} onSave={onSave} />);

    fireEvent.click(screen.getByRole("button", { name: "Draft" }));
    fireEvent.change(await screen.findByLabelText("任务标题"), { target: { value: "Keep this draft" } });
    fireEvent.click(screen.getByRole("button", { name: "保存" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("保存失败，请重试。");
    expect(screen.getByLabelText("任务标题")).toHaveValue("Keep this draft");
  });
});
