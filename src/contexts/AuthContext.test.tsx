import { useState, type ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./AuthContext";
import { DemoModeProvider, useDemoMode } from "./DemoModeContext";

const auth = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth } }));

function sessionFor(id: string, token = "token"): Session {
  return { user: { id }, access_token: token } as Session;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

let notifyAuth: (event: AuthChangeEvent, session: Session | null) => void;
const clients: QueryClient[] = [];

function mount(children: ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 180_000 } } });
  clients.push(client);
  let activeClient = client;
  function CaptureClient() {
    activeClient = useQueryClient();
    return <>{children}</>;
  }
  const view = render(
    <QueryClientProvider client={client}>
      <DemoModeProvider><AuthProvider><CaptureClient /></AuthProvider></DemoModeProvider>
    </QueryClientProvider>,
  );
  return { ...view, get client() { return activeClient; } };
}

function Probe() {
  const { user, loading } = useAuth();
  const { isDemo, enterDemo, exitDemo } = useDemoMode();
  const [draft, setDraft] = useState("");
  return <>
    <p>{loading ? "loading" : user?.id ?? "signed out"}</p>
    <input aria-label="private draft" value={draft} onChange={(e) => setDraft(e.target.value)} />
    <button onClick={isDemo ? exitDemo : enterDemo}>switch demo</button>
  </>;
}

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  auth.getSession.mockResolvedValue({ data: { session: sessionFor("A") }, error: null });
  auth.signOut.mockResolvedValue({ error: null });
  auth.onAuthStateChange.mockImplementation((callback) => {
    notifyAuth = callback;
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  });
});
afterEach(() => { cleanup(); clients.splice(0).forEach((client) => client.clear()); });

describe("authenticated data lifecycle", () => {
  it("isolates late mutation callbacks from the new account cache", async () => {
    const view = mount(<Probe />);
    await screen.findByText("A");
    const oldClient = view.client;
    const pendingWrite = deferred<string>();
    const mutation = oldClient.getMutationCache().build(oldClient, {
      mutationFn: () => pendingWrite.promise,
      onSuccess: (data: string) => oldClient.setQueryData(["private"], data),
    });
    const pending = mutation.execute(undefined);
    act(() => notifyAuth("SIGNED_IN", sessionFor("B")));
    await screen.findByText("B");
    expect(view.client).not.toBe(oldClient);
    view.client.setQueryData(["private"], "B data");
    await act(async () => { pendingWrite.resolve("A late save"); await pending; });
    expect(view.client.getQueryData(["private"])).toBe("B data");
  });

  it("fetches fresh private data when account A changes to B", async () => {
    function PrivateData() {
      const { user } = useAuth();
      const { data } = useQuery({ queryKey: ["private"], queryFn: async () => user?.id, enabled: !!user });
      return <p>private: {data}</p>;
    }
    mount(<PrivateData />);
    await screen.findByText("private: A");
    act(() => notifyAuth("SIGNED_IN", sessionFor("B")));
    await screen.findByText("private: B");
    expect(screen.queryByText("private: A")).not.toBeInTheDocument();
  });

  it("preserves fresh cache and drafts on a same-user token refresh", async () => {
    const view = mount(<Probe />);
    await screen.findByText("A");
    const { client } = view;
    client.setQueryData(["private"], "A data");
    fireEvent.change(screen.getByLabelText("private draft"), { target: { value: "unfinished" } });
    act(() => notifyAuth("TOKEN_REFRESHED", sessionFor("A", "new-token")));
    expect(client.getQueryData(["private"])).toBe("A data");
    expect(screen.getByLabelText("private draft")).toHaveValue("unfinished");
  });

  it("cancels old reads and prevents late results from repopulating a signed-out cache", async () => {
    const view = mount(<Probe />);
    await screen.findByText("A");
    const { client } = view;
    const oldRead = deferred<string>();
    let signal!: AbortSignal;
    const pending = client.fetchQuery({ queryKey: ["private"], queryFn: (context) => {
      signal = context.signal;
      return oldRead.promise;
    } }).catch(() => undefined);
    act(() => notifyAuth("SIGNED_OUT", null));
    expect(signal.aborted).toBe(true);
    oldRead.resolve("A secret");
    await pending;
    expect(client.getQueryData(["private"])).toBeUndefined();
  });

  it("does not replace a newer auth event with an older getSession result", async () => {
    const initial = deferred<{ data: { session: Session } }>();
    auth.getSession.mockReturnValue(initial.promise);
    mount(<Probe />);
    act(() => notifyAuth("SIGNED_IN", sessionFor("B")));
    await act(async () => initial.resolve({ data: { session: sessionFor("A") } }));
    expect(screen.getByText("B")).toBeInTheDocument();
  });

  it("finishes loading if restoring the session rejects", async () => {
    auth.getSession.mockRejectedValue(new Error("storage unavailable"));
    mount(<Probe />);
    await screen.findByText("signed out");
    expect(screen.queryByText("loading")).not.toBeInTheDocument();
  });

  it("remounts private drafts when the user or demo scope changes", async () => {
    mount(<Probe />);
    await screen.findByText("A");
    fireEvent.change(screen.getByLabelText("private draft"), { target: { value: "A draft" } });
    act(() => notifyAuth("SIGNED_IN", sessionFor("B")));
    await waitFor(() => expect(screen.getByLabelText("private draft")).toHaveValue(""));
    fireEvent.change(screen.getByLabelText("private draft"), { target: { value: "B draft" } });
    fireEvent.click(screen.getByRole("button", { name: "switch demo" }));
    expect(screen.getByLabelText("private draft")).toHaveValue("");
    fireEvent.change(screen.getByLabelText("private draft"), { target: { value: "demo draft" } });
    fireEvent.click(screen.getByRole("button", { name: "switch demo" }));
    expect(screen.getByLabelText("private draft")).toHaveValue("");
  });
});
