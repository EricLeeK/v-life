import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import LearningNotesPage from "./LearningNotes";

const api = vi.hoisted(() => {
  const courses = ["A", "B", "C"].map(id => ({ id, name: `课程${id}`, color: "#5b88b5", description: "" }));
  const notes = [
    { id: "a1", course_id: "A", title: "A第一课", content: "# A第一课正文", tags: [], note_date: "2026-11-05" },
    { id: "a2", course_id: "A", title: "A第二课", content: "# A第二课正文", tags: [], note_date: "2026-11-04" },
    { id: "b1", course_id: "B", title: "B第一课", content: "# B第一课正文", tags: [], note_date: "2026-11-05" },
  ];
  return { courses, notes, save: vi.fn(), mutate: vi.fn() };
});
vi.mock("@/components/AppLayout", () => ({ AppLayout: ({ children }) => <div>{children}</div> }));
vi.mock("@/components/LearningCourseModal", () => ({ LearningCourseModal: () => null }));
vi.mock("@/components/LearningCourseSidebar", () => ({ LearningCourseSidebar: ({ courses, onSelect }) => <nav>{courses.map(course => <button key={course.id} onClick={() => onSelect(course.id)}>{course.name}</button>)}</nav> }));
vi.mock("@/contexts/DemoModeContext", () => ({ useDemoMode: () => ({ isDemo: true, demoData: { learning_notes: api.notes } }) }));
vi.mock("@/hooks/useData", () => ({
  useLearningCourses: () => ({ data: api.courses }),
  useLearningNotes: (id: string) => ({ data: api.notes.filter(note => note.course_id === id) }),
  useUpdateLearningNote: () => ({ mutateAsync: api.save }),
  ...Object.fromEntries(["useCreateLearningCourse", "useUpdateLearningCourse", "useDeleteLearningCourse", "useCreateLearningNote", "useDeleteLearningNote"].map(name => [name, () => ({ mutateAsync: api.mutate })])),
}));
function show() { render(<MemoryRouter><LearningNotesPage /></MemoryRouter>); }
async function editSecond() {
  fireEvent.click(await screen.findByRole("button", { name: /A第二课 2026/ }));
  fireEvent.mouseDown(screen.getByRole("tab", { name: "编辑" }), { button: 0, ctrlKey: false });
  fireEvent.change(screen.getByDisplayValue("# A第二课正文"), { target: { value: "# A第二课新草稿" } });
}
beforeEach(() => { api.save.mockReset().mockResolvedValue(undefined); });
describe("course switching", () => {
  it("shows the new course's first note after choosing another lesson", async () => {
    show();
    fireEvent.click(await screen.findByRole("button", { name: /A第二课 2026/ }));
    fireEvent.click(screen.getByRole("button", { name: "课程B" }));
    expect(await screen.findByRole("heading", { name: "B第一课正文" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "A第二课正文" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "课程A" }));
    expect(await screen.findByRole("heading", { name: "A第一课正文" })).toBeInTheDocument();
  });
  it("saves the previous course's draft before displaying the next course", async () => {
    let finish!: () => void;
    api.save.mockImplementation(() => new Promise<void>(resolve => { finish = resolve; }));
    show(); await editSecond();
    fireEvent.click(screen.getByRole("button", { name: "课程B" }));
    await waitFor(() => expect(api.save).toHaveBeenCalledWith(expect.objectContaining({ id: "a2", course_id: "A", content: "# A第二课新草稿" })));
    expect(screen.getByDisplayValue("# A第二课新草稿")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "B第一课正文" })).not.toBeInTheDocument();
    await act(async () => { finish(); });
    expect(await screen.findByRole("heading", { name: "B第一课正文" })).toBeInTheDocument();
  });
  it("keeps the original draft visible if saving fails", async () => {
    api.save.mockRejectedValue(new Error("offline"));
    show(); await editSecond();
    fireEvent.click(screen.getByRole("button", { name: "课程B" }));
    await waitFor(() => expect(api.save).toHaveBeenCalled());
    expect(screen.getByDisplayValue("# A第二课新草稿")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "B第一课正文" })).not.toBeInTheDocument();
  });
});
