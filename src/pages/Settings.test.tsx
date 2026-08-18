import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SettingsPage from "@/pages/Settings";

vi.mock("@/components/AppLayout", () => ({
  AppLayout: ({ children, title }: { children: React.ReactNode; title?: string }) => (
    <div>
      <h1>{title}</h1>
      {children}
    </div>
  ),
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLang: () => ({ lang: "zh", t: (zh: string) => zh }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "system", setTheme: vi.fn() }),
}));

vi.mock("@/hooks/useHostedAiStatus", () => ({
  useHostedAiStatus: () => ({ data: { active: false } }),
}));

vi.mock("@/hooks/useData", () => ({
  useSettings: () => ({
    isLoading: false,
    data: {
      id: "s1",
      user_id: "u1",
      display_name: "测试",
      ai_platform: "deepseek",
      ai_model: "deepseek-chat",
      ai_vision_platform: "gemini",
      ai_vision_model: "gemini-2.5-flash",
      ai_mode: "confirm",
      day_start_hour: 0,
      app_focus_mode: "full",
    },
  }),
  useUpdateSettings: () => ({ mutateAsync: vi.fn() }),
}));

describe("SettingsPage", () => {
  it("renders AI settings without crashing", () => {
    render(<SettingsPage />);
    expect(screen.getByText("AI 模型与 Key 配置")).toBeInTheDocument();
    expect(screen.getByText("智能路由 · 成本优化")).toBeInTheDocument();
  });

  it("renders the section nav with all grouped sections", () => {
    render(<SettingsPage />);
    for (const label of ["通用", "AI", "日程", "个性", "健康·财务", "数据"]) {
      expect(screen.getByRole("button", { name: label })).toBeInTheDocument();
    }
  });
});
