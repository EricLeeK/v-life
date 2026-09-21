import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useLocalDate } from "./useLocalDate";

afterEach(() => vi.useRealTimers());

describe("local calendar date", () => {
  it("follows the local day at midnight without a reload", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 8, 23, 59, 59));
    const { result, unmount } = renderHook(() => useLocalDate());
    expect(result.current).toBe("2026-09-08");
    act(() => { vi.advanceTimersByTime(1100); });
    expect(result.current).toBe("2026-09-09");
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
