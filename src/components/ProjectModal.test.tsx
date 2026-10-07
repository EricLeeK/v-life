import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectModal } from "./ProjectModal";
import { DateField } from "./arc/DateField";

vi.mock("@/contexts/LanguageContext", () => ({ useLang: () => ({ lang: "zh", t: (zh: string) => zh }) }));
beforeEach(() => {
  const matchMedia = window.matchMedia;
  vi.spyOn(window, "matchMedia").mockImplementation(query => ({ ...matchMedia(query), matches: query.includes("prefers-reduced-motion") }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

describe("project target range", () => {
  it("keeps both dates after Apply, save, and reopening the saved project", async () => {
    const save = vi.fn();
    const initial = { name: "论文", target_date: "2026-11-30" };
    const { rerender } = render(<ProjectModal open onOpenChange={() => {}} onSave={save} initial={initial} />);
    fireEvent.click(screen.getByRole("button", { name: /^目标日期:/ }));
    fireEvent.click(screen.getByRole("button", { name: "Previous month" }));
    fireEvent.click(await screen.findByRole("button", { name: /2026年10月7日/ }));
    fireEvent.click(screen.getByRole("button", { name: "Next month" }));
    const day = await waitFor(() => {
      const node = document.querySelector<HTMLButtonElement>('[data-current] button[data-date="2026-11-30"]');
      expect(node).not.toBeNull();
      return node!;
    });
    fireEvent.click(day);
    expect(screen.getByRole("dialog", { name: "目标日期" }).querySelector("[aria-live]")).toHaveTextContent("55 days");
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    await waitFor(() => expect(screen.getByRole("button", { name: /^目标日期:/ })).toHaveAttribute("aria-expanded", "false"));
    fireEvent.click(screen.getByRole("button", { name: /^目标日期:/ }));
    expect(screen.getByRole("dialog", { name: "目标日期" }).querySelector("[aria-live]")).toHaveTextContent("55 days");
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    fireEvent.click(screen.getByRole("button", { name: "保存修改" }));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ target_start_date: "2026-10-07", target_date: "2026-11-30" }));
    rerender(<ProjectModal open={false} onOpenChange={() => {}} onSave={save} initial={null} />);
    rerender(<ProjectModal open onOpenChange={() => {}} onSave={save} initial={save.mock.calls[0][0]} />);
    fireEvent.click(screen.getByRole("button", { name: /^目标日期:/ }));
    expect(screen.getByRole("dialog", { name: "目标日期" }).querySelector("[aria-live]")).toHaveTextContent("55 days");
  });

  it("preserves the scalar date contract for other forms", () => {
    const change = vi.fn();
    render(<DateField label="截止日期" value="2026-11-30" onChange={change} />);
    fireEvent.click(screen.getByRole("button", { name: /^截止日期:/ }));
    fireEvent.click(screen.getByRole("button", { name: /2026年11月20日/ }));
    fireEvent.click(screen.getByRole("button", { name: /^2026年11月30日/ }));
    fireEvent.click(screen.getByRole("button", { name: "Apply" }));
    expect(change).toHaveBeenCalledWith("2026-11-30");
  });
});
