import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LearningNotePanel } from "./LearningNotePanel";

const course = {
  id: "course-1",
  name: "Deep Learning",
  description: "Neural networks course",
  color: "#5b88b5",
  created_at: "2026-05-01T00:00:00Z",
  updated_at: "2026-05-01T00:00:00Z",
  user_id: "user-1",
};

const notes = [
  {
    id: "note-1",
    course_id: "course-1",
    title: "Backpropagation",
    content: "## Chain rule\n\n- Compute gradients",
    tags: ["lecture"],
    note_date: "2026-05-10",
    created_at: "2026-05-10T00:00:00Z",
    updated_at: "2026-05-10T00:00:00Z",
  },
];

describe("LearningNotePanel", () => {
  it("renders preview by default and can switch to markdown editing", () => {
    render(
      <LearningNotePanel
        course={course}
        notes={notes}
        onCreateNote={vi.fn()}
        onSaveNote={vi.fn()}
        onDeleteNote={vi.fn()}
      />,
    );

    expect(screen.getByRole("heading", { name: "Chain rule" })).toBeInTheDocument();
    expect(screen.getByText("Compute gradients")).toBeInTheDocument();

    const editTab = screen.getByRole("tab", { name: /编辑/ });
    fireEvent.mouseDown(editTab, { button: 0, ctrlKey: false });

    expect(screen.getByDisplayValue(/Chain rule/)).toBeInTheDocument();
  });

  it("does not use system emoji in the note panel chrome", () => {
    const { container } = render(
      <LearningNotePanel
        course={course}
        notes={notes}
        onCreateNote={vi.fn()}
        onSaveNote={vi.fn()}
        onDeleteNote={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: /AI 助手/ })).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/✨|🎨|🎓|💡|⚡|📚/);
  });

  it("deletes a note only after a second confirming click", async () => {
    const onDeleteNote = vi.fn().mockResolvedValue(undefined);
    render(
      <LearningNotePanel
        course={course}
        notes={notes}
        onCreateNote={vi.fn()}
        onSaveNote={vi.fn()}
        onDeleteNote={onDeleteNote}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "删除笔记" }));
    expect(onDeleteNote).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "再次点击确认删除" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "再次点击确认删除" }));
    await waitFor(() =>
      expect(onDeleteNote).toHaveBeenCalledWith({ id: "note-1", course_id: "course-1" }),
    );
  });

  it("cancels the pending delete when clicking outside the delete button", () => {
    const onDeleteNote = vi.fn().mockResolvedValue(undefined);
    render(
      <LearningNotePanel
        course={course}
        notes={notes}
        onCreateNote={vi.fn()}
        onSaveNote={vi.fn()}
        onDeleteNote={onDeleteNote}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "删除笔记" }));
    expect(screen.getByRole("button", { name: "再次点击确认删除" })).toBeInTheDocument();

    fireEvent.pointerDown(screen.getByRole("heading", { name: "Backpropagation" }));
    expect(screen.getByRole("button", { name: "删除笔记" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "删除笔记" }));
    expect(onDeleteNote).not.toHaveBeenCalled();
  });

  it("jumps to the newly created note in edit mode even before notes refresh", async () => {
    const created = {
      id: "note-2",
      course_id: "course-1",
      title: "新笔记",
      content: "",
      tags: [] as string[],
      note_date: "2026-05-12",
      created_at: "2026-05-12T00:00:00Z",
      updated_at: "2026-05-12T00:00:00Z",
    };
    const onCreateNote = vi.fn().mockResolvedValue(created);
    render(
      <LearningNotePanel
        course={course}
        notes={notes}
        onCreateNote={onCreateNote}
        onSaveNote={vi.fn()}
        onDeleteNote={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /新建笔记/ }));

    // notes prop 仍是旧列表（真实应用中缓存乐观更新会补上新笔记）
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: "编辑" })).toHaveAttribute("data-state", "active");
    });
    expect(screen.getByDisplayValue("新笔记")).toBeInTheDocument();
    expect(screen.queryByDisplayValue("Backpropagation")).not.toBeInTheDocument();
  });

  it("autosaves after editing without clicking save", async () => {
    vi.useFakeTimers();
    const onSaveNote = vi.fn().mockResolvedValue(undefined);
    render(
      <LearningNotePanel
        course={course}
        notes={notes}
        onCreateNote={vi.fn()}
        onSaveNote={onSaveNote}
        onDeleteNote={vi.fn()}
      />,
    );

    fireEvent.mouseDown(screen.getByRole("tab", { name: /编辑/ }), { button: 0, ctrlKey: false });
    fireEvent.change(screen.getByLabelText(/内容/), { target: { value: "autosaved draft" } });

    expect(onSaveNote).not.toHaveBeenCalled();
    await act(async () => {
      vi.advanceTimersByTime(1200);
      await Promise.resolve();
    });
    expect(onSaveNote).toHaveBeenCalledWith(
      expect.objectContaining({ id: "note-1", content: "autosaved draft" }),
      expect.objectContaining({ source: "auto" }),
    );
    vi.useRealTimers();
  });
});
