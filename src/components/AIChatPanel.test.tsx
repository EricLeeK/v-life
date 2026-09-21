import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AIChatPanel } from "./AIChatPanel";

const api = vi.hoisted(() => ({
  invoke: vi.fn(),
  from: vi.fn(),
  loadMessages: vi.fn(),
  insertPantry: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: api.from, functions: { invoke: api.invoke } } }));
vi.mock("@/hooks/useData", () => ({ useSettings: () => ({ data: { ai_mode: "confirm" } }) }));
vi.mock("@/contexts/DemoModeContext", () => ({ useDemoMode: () => ({ isDemo: false }) }));
vi.mock("@/contexts/LanguageContext", () => ({ useLang: () => ({ lang: "en", t: (_zh: string, en: string) => en }) }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

const sessions = [
  { id: "older", title: "Older conversation", updated_at: "2026-09-07T10:00:00Z" },
  { id: "other", title: "Another conversation", updated_at: "2026-09-06T10:00:00Z" },
];
const previewResponse = {
  data: { result: { summary: "Record milk", operations: [{ module: "pantry", action: "create", data: { name: "Milk" } }] } },
  error: null,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function renderChat() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });
  client.setQueryData(["ai_sessions"], sessions);
  return render(<QueryClientProvider client={client}><AIChatPanel initialOpen /></QueryClientProvider>);
}

function enterMessage(text = "Please record milk") {
  const input = screen.getByRole("textbox", { name: "Message input" });
  fireEvent.change(input, { target: { value: text } });
  return input;
}

describe("AI chat interaction safety", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.invoke.mockResolvedValue(previewResponse);
    api.loadMessages.mockResolvedValue({ data: [{ role: "assistant", content: "Older reply", images: null, actions: null }], error: null });
    api.insertPantry.mockResolvedValue({ data: { id: "milk" }, error: null });
    api.from.mockImplementation((table: string) => {
      if (table === "ai_sessions") return {
        select: () => ({ order: () => ({ limit: async () => ({ data: sessions, error: null }) }) }),
        insert: () => ({ select: () => ({ single: async () => ({ data: { id: "current" }, error: null }) }) }),
        update: () => ({ eq: async () => ({ error: null }) }),
      };
      if (table === "ai_messages") return {
        insert: async () => ({ error: null }),
        select: () => ({ eq: (_column: string, id: string) => ({ order: () => api.loadMessages(id) }) }),
      };
      if (table === "pantry_items") return {
        insert: (row: unknown) => ({ select: () => ({ single: () => api.insertPantry(row) }) }),
      };
      throw new Error(`Unexpected test table: ${table}`);
    });
  });
  afterEach(cleanup);

  it.each([
    { isComposing: true, keyCode: 13 },
    { isComposing: false, keyCode: 229 },
  ])("leaves IME candidate Enter to the browser (%j)", async (composition) => {
    renderChat();
    const input = enterMessage("牛奶");
    const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true, ...composition });
    act(() => { input.dispatchEvent(event); });
    expect(event.defaultPrevented).toBe(false);
    expect(input).toHaveValue("牛奶");
    await act(async () => {});
    expect(api.invoke).not.toHaveBeenCalled();
  });

  it("allows Shift+Enter newline and sends on ordinary Enter", async () => {
    renderChat();
    const input = enterMessage();
    const event = new KeyboardEvent("keydown", { key: "Enter", shiftKey: true, bubbles: true, cancelable: true });
    act(() => { input.dispatchEvent(event); });
    expect(event.defaultPrevented).toBe(false);
    expect(api.invoke).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() => expect(api.invoke).toHaveBeenCalledTimes(1));
    await screen.findByRole("button", { name: "Confirm" });
  });

  it("executes an operation only once for two clicks before React renders", async () => {
    renderChat();
    fireEvent.keyDown(enterMessage(), { key: "Enter" });
    const confirm = await screen.findByRole("button", { name: "Confirm" });
    await waitFor(() => expect(confirm).toBeEnabled());
    const insert = deferred<{ data: { id: string }; error: null }>();
    api.insertPantry.mockReturnValue(insert.promise);
    act(() => {
      confirm.click();
      confirm.click();
    });
    expect(api.insertPantry).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "New chat" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "History" })).toBeDisabled();
    await act(async () => { insert.resolve({ data: { id: "milk" }, error: null }); });
    expect(await screen.findByText("Executed")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Confirm" })).not.toBeInTheDocument();
    act(() => { confirm.click(); });
    expect(api.insertPantry).toHaveBeenCalledTimes(1);
  });

  it("keeps the active conversation fixed while a reply is in flight", async () => {
    const reply = deferred<typeof previewResponse>();
    api.invoke.mockReturnValue(reply.promise);
    renderChat();
    fireEvent.keyDown(enterMessage(), { key: "Enter" });
    await waitFor(() => expect(api.invoke).toHaveBeenCalledTimes(1));
    expect(screen.getByRole("button", { name: "New chat" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "History" })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "New chat" }));
    fireEvent.click(screen.getByRole("button", { name: "History" }));
    expect(screen.getByText("Please record milk")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Older conversation" })).not.toBeInTheDocument();
    await act(async () => { reply.resolve(previewResponse); });
    expect(screen.getByText("Please record milk")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("button", { name: "New chat" })).toBeEnabled());
  });

  it("prevents overlapping history loads and a new conversation during history loading", async () => {
    const history = deferred<{ data: Array<{ role: string; content: string; images: null; actions: null }>; error: null }>();
    api.loadMessages.mockReturnValue(history.promise);
    renderChat();
    fireEvent.click(screen.getByRole("button", { name: "History" }));
    const older = screen.getByRole("button", { name: "Older conversation" });
    const another = screen.getByRole("button", { name: "Another conversation" });
    const newChat = screen.getByRole("button", { name: "New chat" });
    act(() => {
      older.click();
      another.click();
      newChat.click();
    });
    expect(api.loadMessages).toHaveBeenCalledTimes(1);
    expect(newChat).toBeDisabled();
    await act(async () => {
      history.resolve({ data: [{ role: "assistant", content: "Older reply", images: null, actions: null }], error: null });
    });
    expect(await screen.findByText("Older reply")).toBeInTheDocument();
  });
});
