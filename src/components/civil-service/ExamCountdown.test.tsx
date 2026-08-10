import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ExamCountdown } from "./ExamCountdown";

const exams = [
  {
    id: "near-exam",
    user_id: "user-1",
    name: "近期省考",
    exam_date: "2099-05-20",
    exam_type: "省考",
    is_primary: false,
    is_archived: false,
    notes: null,
    created_at: null,
    updated_at: null,
  },
  {
    id: "far-exam",
    user_id: "user-1",
    name: "远期国考",
    exam_date: "2100-11-30",
    exam_type: "国考",
    is_primary: true,
    is_archived: false,
    notes: null,
    created_at: null,
    updated_at: null,
  },
];

vi.mock("@/contexts/LanguageContext", () => ({
  useLang: () => ({ t: (zh: string) => zh }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("@/hooks/useCivilService", () => ({
  useCivilExams: () => ({ data: exams }),
  useCreateCivilExam: () => ({ mutateAsync: vi.fn() }),
  useUpdateCivilExam: () => ({ mutate: vi.fn() }),
  useDeleteCivilExam: () => ({ mutate: vi.fn() }),
}));

describe("ExamCountdown", () => {
  it("shows every target and gives the nearest exam the largest countdown", () => {
    render(<ExamCountdown />);

    const nearTarget = screen.getByText("近期省考").closest("[data-countdown-size]");
    const farTarget = screen.getByText("远期国考").closest("[data-countdown-size]");

    expect(nearTarget).toHaveAttribute("data-countdown-size", "primary");
    expect(farTarget).toHaveAttribute("data-countdown-size", "secondary");
  });
});
