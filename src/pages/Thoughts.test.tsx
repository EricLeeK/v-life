import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { LangProvider } from "@/contexts/LanguageContext";
import ThoughtsPage from "./Thoughts";

const mocks = vi.hoisted(() => ({
  useList: vi.fn(),
  useCreate: vi.fn(),
  useUpdate: vi.fn(),
  useDelete: vi.fn(),
  useSettings: vi.fn(),
}));

vi.mock("@/hooks/useData", () => ({
  thoughtHooks: {
    useList: mocks.useList,
    useCreate: mocks.useCreate,
    useUpdate: mocks.useUpdate,
    useDelete: mocks.useDelete,
  },
  useSettings: mocks.useSettings,
}));

vi.mock("@/components/AppLayout", () => ({ AppLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main> }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const thought = {
  id: "thought-1",
  title: "A patient idea",
  content: "## The first step\n\nA **small observation** worth keeping.\n\n- Notice it\n- Write it down",
  tags: ["科研"],
  icon: "lightbulb",
  created_at: "2026-11-05T08:30:00.000Z",
};

function renderThoughts() {
  return render(<LangProvider><ThoughtsPage /></LangProvider>);
}

describe("Thoughts page", () => {
  beforeEach(() => {
    mocks.useList.mockReturnValue({ data: [thought], isLoading: false, error: null, refetch: vi.fn() });
    mocks.useSettings.mockReturnValue({ data: null });
    mocks.useCreate.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue({ ...thought, id: "thought-2" }) });
    mocks.useUpdate.mockReturnValue({ mutateAsync: vi.fn().mockResolvedValue(undefined) });
    mocks.useDelete.mockReturnValue({ mutate: vi.fn() });
  });

  it("renders markdown inside content-sized masonry cards", () => {
    const { container } = renderThoughts();

    expect(screen.getByRole("heading", { name: "The first step" })).toBeInTheDocument();
    expect(screen.getByText("small observation")).toBeInTheDocument();
    expect(container.querySelector(".thought-masonry")).toBeInTheDocument();
    expect(container.querySelector(".thought-card-markdown")).toBeInTheDocument();
  });

  it("opens writing-first zen mode and keeps the draft when returning to the list", () => {
    renderThoughts();

    fireEvent.click(screen.getByRole("button", { name: "专注写作" }));
    fireEvent.change(screen.getByLabelText("随想内容"), { target: { value: "An unhurried thought." } });
    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("dialog", { name: "专注写作工作区" })).not.toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "专注写作" }));
    fireEvent.click(screen.getByRole("button", { name: "专注写作" }));
    expect(screen.getByLabelText("随想内容")).toHaveValue("An unhurried thought.");
  });

  it("opens an existing thought for focused editing and saves it before starting another", async () => {
    const update = vi.fn().mockResolvedValue(undefined);
    mocks.useUpdate.mockReturnValue({ mutateAsync: update });
    renderThoughts();

    fireEvent.click(screen.getByRole("button", { name: "专注编辑随想" }));
    const zen = screen.getByRole("dialog", { name: "专注写作工作区" });
    const content = within(zen).getByLabelText("随想内容");
    expect(content).toHaveValue(thought.content);
    fireEvent.change(content, { target: { value: "A revised thought." } });
    fireEvent.click(within(zen).getByRole("button", { name: "新随想" }));

    expect(update).toHaveBeenCalledWith(expect.objectContaining({ id: thought.id, content: "A revised thought." }));
    await waitFor(() => expect(within(zen).getByLabelText("随想内容")).toHaveValue(""));
  });

  it("keeps the current thought when saving it fails before starting another", async () => {
    mocks.useUpdate.mockReturnValue({ mutateAsync: vi.fn().mockRejectedValue(new Error("Network unavailable")) });
    renderThoughts();

    fireEvent.click(screen.getByRole("button", { name: "专注编辑随想" }));
    const zen = screen.getByRole("dialog", { name: "专注写作工作区" });
    fireEvent.change(within(zen).getByLabelText("随想内容"), { target: { value: "Unsaved edit stays here." } });
    fireEvent.click(within(zen).getByRole("button", { name: "新随想" }));

    expect(await within(zen).findByRole("alert")).toHaveTextContent("Network unavailable");
    expect(within(zen).getByLabelText("随想内容")).toHaveValue("Unsaved edit stays here.");
  });

  it("does not report a draft saved if the user edits during an in-flight save", async () => {
    let resolveCreate!: (value: unknown) => void;
    mocks.useCreate.mockReturnValue({ mutateAsync: vi.fn(() => new Promise((resolve) => { resolveCreate = resolve; })) });
    renderThoughts();

    fireEvent.click(screen.getByRole("button", { name: "专注写作" }));
    const zen = screen.getByRole("dialog", { name: "专注写作工作区" });
    const editor = within(zen).getByLabelText("随想内容");
    fireEvent.change(editor, { target: { value: "First version." } });
    fireEvent.click(within(zen).getByRole("button", { name: "保存随想" }));
    fireEvent.change(editor, { target: { value: "Newer version." } });

    await act(async () => {
      resolveCreate({ id: "thought-2" });
    });

    expect(within(zen).getByLabelText("随想内容")).toHaveValue("Newer version.");
    expect(within(zen).getByRole("button", { name: "保存随想" })).toBeEnabled();
    expect(within(zen).getByRole("status")).not.toHaveTextContent("已保存");
  });

  it("does not replace an exited draft with another card when draft saving fails", async () => {
    mocks.useCreate.mockReturnValue({ mutateAsync: vi.fn().mockRejectedValue(new Error("Offline")) });
    renderThoughts();

    fireEvent.click(screen.getByRole("button", { name: "专注写作" }));
    fireEvent.change(screen.getByLabelText("随想内容"), { target: { value: "Draft to keep." } });
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "专注编辑随想" }));

    expect(screen.queryByRole("dialog", { name: "专注写作工作区" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "专注写作" }));
    expect(screen.getByLabelText("随想内容")).toHaveValue("Draft to keep.");
  });
});
