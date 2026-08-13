import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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
});
