import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppCommandPalette } from "./AppCommandPalette";

const settings = vi.hoisted(() => ({ hidden_features: [] as string[], app_focus_mode: "full" }));
vi.mock("@/hooks/useData", () => ({ useSettings: () => ({ data: settings }) }));
vi.mock("@/contexts/LanguageContext", () => ({ useLang: () => ({ t: (zh: string) => zh }) }));

function Location() { return <output aria-label="当前路由">{useLocation().pathname}</output>; }
function show() { return render(<MemoryRouter><AppCommandPalette /><Location /></MemoryRouter>); }

beforeEach(() => { settings.hidden_features = []; settings.app_focus_mode = "full"; });
describe("Arc app command navigation", () => {
  it("filters the original command list and executes the selected route with Enter", async () => {
    show();
    fireEvent.click(screen.getByRole("button", { name: /搜索功能/ }));
    const input = await screen.findByRole("combobox", { name: "搜索功能" });
    fireEvent.change(input, { target: { value: "记账" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(screen.getByLabelText("当前路由")).toHaveTextContent("/finance"));
  });

  it("honors feature visibility rather than revealing hidden routes", async () => {
    settings.hidden_features = ["finance"];
    show();
    fireEvent.click(screen.getByRole("button", { name: /搜索功能/ }));
    const input = await screen.findByRole("combobox", { name: "搜索功能" });
    fireEvent.change(input, { target: { value: "记账" } });
    expect(screen.queryByRole("option", { name: /记账/ })).not.toBeInTheDocument();
  });

  it("opens by keyboard, clears the query before closing, and restores focus", async () => {
    show();
    const trigger = screen.getByRole("button", { name: /搜索功能/ });
    trigger.focus();
    fireEvent.keyDown(document, { key: "k", metaKey: true });
    const input = await screen.findByRole("combobox", { name: "搜索功能" });
    fireEvent.change(input, { target: { value: "日程" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input).toHaveValue("");
    fireEvent.keyDown(input, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});
