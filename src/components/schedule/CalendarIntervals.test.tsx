import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MonthView } from "./MonthView";
import { EventBlock, yToTime } from "./EventBlock";

vi.mock("@/contexts/LanguageContext", () => ({
  useLang: () => ({ lang: "zh", t: (zh: string) => zh }),
}));

afterEach(cleanup);

const event = {
  id: "overnight",
  title: "跨夜旅行",
  start_time: "2026-09-08T23:00:00",
  end_time: "2026-09-09T01:00:00",
};

describe("calendar date intervals", () => {
  it("shows an overnight event on both covered calendar days", () => {
    render(<MonthView baseDate={new Date(2026, 8, 8)} events={[event]} onEdit={vi.fn()} onCreateAt={vi.fn()} />);
    expect(screen.getAllByRole("button", { name: /跨夜旅行/ })).toHaveLength(2);
  });

  it("does not include the next day when an event ends exactly at midnight", () => {
    render(<MonthView baseDate={new Date(2026, 8, 8)} events={[{ ...event, end_time: "2026-09-09T00:00:00" }]} onEdit={vi.fn()} onCreateAt={vi.fn()} />);
    expect(screen.getAllByRole("button", { name: /跨夜旅行/ })).toHaveLength(1);
  });

  it("clips each day segment to its own 24-hour interval", () => {
    render(<EventBlock event={event} day={new Date(2026, 8, 8)} onEdit={vi.fn()} onDragEnd={vi.fn()} />);
    expect(screen.getByRole("button", { name: /跨夜旅行/ })).toHaveStyle({ top: "1380px", height: "60px" });

    cleanup();
    render(<EventBlock event={event} day={new Date(2026, 8, 9)} onEdit={vi.fn()} onDragEnd={vi.fn()} />);
    expect(screen.getByRole("button", { name: /跨夜旅行/ })).toHaveStyle({ top: "0px", height: "60px" });
  });

  it("represents the bottom edge as the next day's midnight", () => {
    const result = yToTime(24 * 60, new Date(2026, 8, 8));
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(8);
    expect(result.getDate()).toBe(9);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
  });
});
