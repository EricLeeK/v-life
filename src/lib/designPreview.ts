import { createDemoDataStore, type DemoDataStore } from "@/data/demoSeed";
import type { FortuneReadingRow } from "@/hooks/useFortune";
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";

export type DesignPreviewState = "empty" | "populated";

/** Explicit local design fixture; never enabled in a production build. */
export function getDesignPreviewState(): DesignPreviewState | null {
  if (!import.meta.env.DEV || typeof window === "undefined") return null;
  const state = new URLSearchParams(window.location.search).get("design-state");
  return state === "empty" || state === "populated" ? state : null;
}

export function createDesignPreviewData(state: DesignPreviewState | null): DemoDataStore {
  const data = createDemoDataStore();
  if (state === "populated") {
    // The finance fixture was authored for a fixed month. Keep the preview
    // useful in any month without changing the regular guest tour's records.
    const latest = data.finance_records.reduce((day, row) => row.date > day ? row.date : day, "");
    const offset = differenceInCalendarDays(new Date(), parseISO(latest));
    data.finance_records = data.finance_records.map(row => ({ ...row,
      name: row.category === "住房" ? "房租" : row.name,
      date: format(addDays(parseISO(row.date), offset), "yyyy-MM-dd"),
    }));
    return data;
  }
  if (state !== "empty") return data;
  // Keep settings and schema defaults; clear only record collections.
  return Object.fromEntries(Object.entries(data).map(([key, value]) => [key, Array.isArray(value) ? [] : value])) as unknown as DemoDataStore;
}

export function createDesignFortuneReadings(state: DesignPreviewState | null): FortuneReadingRow[] {
  if (state !== "populated") return [];
  return [{
    id: "design-reading", user_id: "demo", type: "tarot",
    question: "怎样给这一周留一些自己的时间？", payload: {},
    reading: "先选一件真正想做的小事，为它留出一段完整的时间。记录一次尝试，也给自己留一点调整的余地。",
    created_at: new Date().toISOString(),
  }];
}
