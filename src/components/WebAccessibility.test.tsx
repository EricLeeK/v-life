import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GoalsBall } from "@/components/schedule/GoalsBall";
import { CheckinCard } from "@/components/civil-service/CheckinCard";

vi.mock("@/contexts/LanguageContext", () => ({
  useLang: () => ({ lang: "zh", t: (zh: string) => zh }),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/hooks/useCivilService", () => ({
  useTodayCivilCheckin: () => ({ data: { studied_minutes: 90 } }),
  useUpsertCivilCheckin: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn(() => ({ select: vi.fn() })) },
}));

function withQueryClient(ui: React.ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("desktop web accessibility", () => {
  it("names the schedule goal popover trigger", () => {
    withQueryClient(<GoalsBall />);
    expect(screen.getByRole("button", { name: "当前目标" })).toBeInTheDocument();
  });

  it("gives the civil-service study duration input a persistent label", () => {
    withQueryClient(<CheckinCard />);
    expect(screen.getByRole("spinbutton", { name: "今日学习时长（分钟）" })).toBeInTheDocument();
  });
});
