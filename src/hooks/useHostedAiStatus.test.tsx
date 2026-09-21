import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useHostedAiStatus } from "@/hooks/useHostedAiStatus";

const { from } = vi.hoisted(() => ({
  from: vi.fn(() => {
    throw new Error("demo mode must not contact Supabase");
  }),
}));

vi.mock("@/integrations/supabase/client", () => ({ supabase: { from } }));
vi.mock("@/contexts/DemoModeContext", () => ({ useDemoMode: () => ({ isDemo: true }) }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: null }) }));

describe("useHostedAiStatus", () => {
  it("does not query Supabase while the app is in demo mode", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    const { result } = renderHook(() => useHostedAiStatus(), { wrapper });

    await waitFor(() => expect(result.current.fetchStatus).toBe("idle"));
    expect(from).not.toHaveBeenCalled();
  });
});
