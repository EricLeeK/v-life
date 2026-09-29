import {
  act,
  configure,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DemoModeProvider } from "@/contexts/DemoModeContext";
import { LangProvider } from "@/contexts/LanguageContext";
import NewspapersPage from "./Newspapers";
vi.mock(
  "@/contexts/AuthContext",
  () => ({ useAuth: () => ({ user: { id: "demo-user" } }) }),
);
vi.mock(
  "@/components/AppLayout",
  () => ({
    AppLayout: ({ children }: { children: React.ReactNode }) => (
      <main>{children}</main>
    ),
  }),
);
beforeEach(() => {
  configure({ asyncUtilTimeout: 6000 });
  localStorage.setItem("vlife-demo-mode", "true");
  window.scrollTo = vi.fn();
  Element.prototype.scrollTo = vi.fn();
});
function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <LangProvider>
          <DemoModeProvider>
            <NewspapersPage />
          </DemoModeProvider>
        </LangProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
describe("newspaper archive and reader", () => {
  it(
    "opens an archived paper and returns to the drawer with focus restored",
    async () => {
      renderPage();
      const papers = await screen.findAllByRole("button", {
        name: /展开 .* 生活日报/,
      });
      const label = papers[1].getAttribute("aria-label")!;
      await act(async () => {
        fireEvent.click(papers[1]);
      });
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect(await screen.findByRole("heading", { name: "生活日报", level: 1 }))
        .toBeInTheDocument();
      expect(screen.getByText("生活的另一面")).toBeInTheDocument();
      const immersive = screen.getByRole("dialog", {
        name: "生活日报沉浸阅读",
      });
      expect(immersive).toHaveClass("np-immersive");
      expect(document.querySelector("main")).not.toContainElement(immersive);
      expect(document.body.style.overflow).toBe("hidden");
      await act(async () => {
        fireEvent.keyDown(screen.getByRole("button", { name: "收回档案馆" }), { key: "Escape" });
      });
      const returned = await screen.findByRole("button", { name: label }, {
        timeout: 6000,
      });
      await waitFor(() => expect(returned).toHaveFocus(), { timeout: 6000 });
    },
    20000,
  );
  it("keeps a closed month as an accessible bundle and hides its individual papers until reopened", async () => {
    renderPage();
    const papers = await screen.findAllByRole("button", { name: /展开 .* 生活日报/ });
    const paper = papers[0];
    const drawer = paper.closest(".np-shelf-drawer")!;
    const monthButton = drawer.querySelector<HTMLButtonElement>(".np-shelf-label")!;
    fireEvent.click(monthButton);
    expect(monthButton).toHaveAttribute("aria-expanded", "false");
    expect(drawer.querySelector(".np-stack-reveal")).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("button", { name: paper.getAttribute("aria-label")! })).not.toBeInTheDocument();
    const bundle = drawer.querySelector<HTMLButtonElement>(".np-month-bundle")!;
    expect(bundle).toHaveTextContent("展开本月");
    fireEvent.click(bundle);
    expect(monthButton).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: paper.getAttribute("aria-label")! })).toBeInTheDocument();
  });
  it(
    "autosaves a new supplement verbatim and keeps it after reopening the paper",
    async () => {
      renderPage();
      await waitFor(() =>
        expect(screen.getByRole("button", { name: "读今天的日报" }))
          .toBeEnabled()
      );
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "读今天的日报" }));
      });
      await screen.findByRole("heading", { name: "生活日报", level: 1 });
      fireEvent.click(screen.getByRole("button", { name: "补充记录" }));
      const body = "  今天散步时想到的事。\n\n保留换行和空格。  ";
      fireEvent.change(
        screen.getByRole("textbox", { name: "这一天，还有什么想留下？" }),
        { target: { value: body } },
      );
      await waitFor(
        () =>
          expect(screen.getByRole("textbox", { name: "补充原文" })).toHaveValue(
            body,
          ),
        { timeout: 4000 },
      );
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "收回档案馆" }));
      });
      const today = await screen.findByRole(
        "button",
        { name: "读今天的日报" },
        { timeout: 6000 },
      );
      await act(async () => {
        fireEvent.click(today);
      });
      await waitFor(() =>
        expect(screen.getByRole("textbox", { name: "补充原文" })).toHaveValue(
          body,
        )
      );
    },
    20000,
  );
});
