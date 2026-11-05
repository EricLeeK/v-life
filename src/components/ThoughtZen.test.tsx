import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { ThoughtZen, type ThoughtZenDraft } from "./ThoughtZen";

function renderThoughtZen(onSave = vi.fn().mockResolvedValue(undefined), onExit = vi.fn()) {
  function Harness() {
    const [draft, setDraft] = useState<ThoughtZenDraft>({ title: "", content: "" });
    const [saved, setSaved] = useState(false);
    return <ThoughtZen
      draft={draft}
      onDraftChange={(next) => { setDraft(next); setSaved(false); }}
      onSave={async (next) => { await onSave(next); setSaved(true); }}
      onStartNew={async () => { setDraft({ title: "", content: "" }); setSaved(false); }}
      onExit={onExit}
      saved={saved}
    />;
  }
  return render(<Harness />);
}

describe("ThoughtZen", () => {
  it("keeps the markdown draft when switching between writing and preview", () => {
    renderThoughtZen();

    fireEvent.change(screen.getByLabelText("随想内容"), {
      target: { value: "# A small idea\n\n**Worth keeping.**" },
    });
    fireEvent.click(screen.getByRole("button", { name: "预览" }));

    expect(screen.getByRole("heading", { name: "A small idea" })).toBeInTheDocument();
    expect(screen.getByText("Worth keeping.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "继续编辑" }));
    expect(screen.getByLabelText("随想内容")).toHaveValue("# A small idea\n\n**Worth keeping.**");
  });

  it("saves the current writing and reports successful save feedback", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    renderThoughtZen(onSave);
    fireEvent.change(screen.getByLabelText("随想内容"), { target: { value: "A thought to keep." } });

    fireEvent.click(screen.getByRole("button", { name: "保存随想" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ title: "", content: "A thought to keep." }));
    expect(await screen.findByRole("status")).toHaveTextContent("已保存");
  });

  it("exits zen mode with Escape", () => {
    const onExit = vi.fn();
    renderThoughtZen(undefined, onExit);

    fireEvent.keyDown(document, { key: "Escape" });

    expect(onExit).toHaveBeenCalledOnce();
  });

  it("keeps Tab focus inside the full-screen workspace", () => {
    renderThoughtZen();
    const editor = screen.getByLabelText("随想内容");
    editor.focus();

    fireEvent.keyDown(editor, { key: "Tab" });

    expect(document.activeElement).toBe(screen.getByRole("button", { name: "退出专注写作" }));
  });
});
