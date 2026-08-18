import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, beforeEach } from "vitest";
import { LangProvider } from "@/contexts/LanguageContext";
import { DemoModeProvider } from "@/contexts/DemoModeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "@/pages/Index";

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}

describe("Dashboard homepage", () => {
  beforeEach(() => {
    localStorage.setItem("vlife-demo-mode", "true");
    globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;
  });

  it("renders in demo mode without crashing", () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <TooltipProvider>
          <MemoryRouter>
            <LangProvider>
              <DemoModeProvider>
                <AuthProvider>
                  <Index />
                </AuthProvider>
              </DemoModeProvider>
            </LangProvider>
          </MemoryRouter>
        </TooltipProvider>
      </QueryClientProvider>,
    );
    expect(screen.getAllByText("首页概览").length).toBeGreaterThan(0);
  });
});
