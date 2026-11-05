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

  it("opens a distraction-free workspace and closes it with Escape without discarding the draft", () => {
    render(
      <LearningNotePanel
        course={course}
        notes={notes}
        onCreateNote={vi.fn()}
        onSaveNote={vi.fn().mockResolvedValue(undefined)}
        onDeleteNote={vi.fn()}
      />,
    );

    fireEvent.mouseDown(screen.getByRole("tab", { name: /编辑/ }), { button: 0, ctrlKey: false });
    fireEvent.change(screen.getByLabelText(/内容/), { target: { value: "A draft survives the focus switch." } });
    fireEvent.click(screen.getByRole("button", { name: "专注学习" }));
    expect(screen.getByRole("dialog", { name: "专注学习工作区" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Backpropagation/ })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: "专注学习工作区" })).not.toBeInTheDocument();
    expect(screen.getByLabelText(/内容/)).toHaveValue("A draft survives the focus switch.");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "专注学习" }));
  });

  it("keeps the current note selected when switching notes after editing", async () => {
    const secondNote = { ...notes[0], id: "note-2", title: "Gradient descent", content: "## Step size" };
    const onSaveNote = vi.fn().mockResolvedValue(undefined);
    render(
      <LearningNotePanel
        course={course}
        notes={[notes[0], secondNote]}
        onCreateNote={vi.fn()}
        onSaveNote={onSaveNote}
        onDeleteNote={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "专注学习" }));
    fireEvent.mouseDown(screen.getByRole("tab", { name: /编辑/ }), { button: 0, ctrlKey: false });
    fireEvent.change(screen.getByLabelText(/内容/), { target: { value: "Unsaved but preserved while changing notes." } });
    fireEvent.click(screen.getByRole("button", { name: /Gradient descent/ }));

    await waitFor(() => expect(onSaveNote).toHaveBeenCalledWith(
      expect.objectContaining({ id: "note-1", content: "Unsaved but preserved while changing notes." }),
      expect.objectContaining({ source: "auto" }),
    ));
    expect(await screen.findByRole("heading", { name: "Step size" })).toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "专注学习工作区" })).toBeInTheDocument();
  });

  it("serializes an autosave before the newer save triggered by switching notes", async () => {
    const secondNote = { ...notes[0], id: "note-2", title: "Gradient descent", content: "## Step size" };
    const pendingSaves: Array<{ content: string; resolve: () => void }> = [];
    const onSaveNote = vi.fn((values: { content: string }) => new Promise<void>((resolve) => {
      pendingSaves.push({ content: values.content, resolve });
    }));
    vi.useFakeTimers();
    try {
      render(
        <LearningNotePanel
          course={course}
          notes={[notes[0], secondNote]}
          onCreateNote={vi.fn()}
          onSaveNote={onSaveNote}
          onDeleteNote={vi.fn()}
        />,
      );

      fireEvent.click(screen.getByRole("button", { name: "专注学习" }));
      fireEvent.mouseDown(screen.getByRole("tab", { name: /编辑/ }), { button: 0, ctrlKey: false });
      fireEvent.change(screen.getByLabelText(/内容/), { target: { value: "older autosave" } });
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });
      expect(pendingSaves).toHaveLength(1);
      expect(pendingSaves[0].content).toBe("older autosave");

      fireEvent.change(screen.getByLabelText(/内容/), { target: { value: "newer switch save" } });
      fireEvent.click(screen.getByRole("button", { name: /Gradient descent/ }));
      expect(pendingSaves).toHaveLength(1);

      await act(async () => {
        pendingSaves[0].resolve();
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(pendingSaves).toHaveLength(2);
      expect(pendingSaves[1].content).toBe("newer switch save");

      await act(async () => {
        pendingSaves[1].resolve();
        await Promise.resolve();
      });
      vi.useRealTimers();
      expect(await screen.findByRole("heading", { name: "Step size" })).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps an unsaved draft selected if saving fails during a note switch", async () => {
    const secondNote = { ...notes[0], id: "note-2", title: "Gradient descent", content: "## Step size" };
    const onSaveNote = vi.fn().mockRejectedValue(new Error("Offline"));
    render(
      <LearningNotePanel
        course={course}
        notes={[notes[0], secondNote]}
        onCreateNote={vi.fn()}
        onSaveNote={onSaveNote}
        onDeleteNote={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "专注学习" }));
    fireEvent.mouseDown(screen.getByRole("tab", { name: /编辑/ }), { button: 0, ctrlKey: false });
    fireEvent.change(screen.getByLabelText(/内容/), { target: { value: "Keep this while offline." } });
    fireEvent.click(screen.getByRole("button", { name: /Gradient descent/ }));

    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("保存失败"));
    expect(screen.getByLabelText(/内容/)).toHaveValue("Keep this while offline.");
    expect(screen.getByRole("dialog", { name: "专注学习工作区" })).toBeInTheDocument();
  });
});

 it("opens a linked note when an equally sized course replaces the initial notes", async () => {
  const props = { course, initialNoteId: "linked", onCreateNote: vi.fn(), onSaveNote: vi.fn(), onDeleteNote: vi.fn() };
  const { rerender } = render(<LearningNotePanel {...props} notes={[notes[0], { ...notes[0], id: "other" }]} />);
  rerender(<LearningNotePanel {...props} notes={[{ ...notes[0], id: "first" }, { ...notes[0], id: "linked", content: "## Linked explanation" }]} />);
  expect(await screen.findByRole("heading", { name: "Linked explanation" })).toBeInTheDocument();
 });
