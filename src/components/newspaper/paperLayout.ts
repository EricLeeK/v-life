import type {
  NewspaperEntry,
  NewspaperImageAsset,
  NewspaperReport,
  NewspaperSectionId,
} from "../../../supabase/functions/_shared/newspaperTypes";
import { pickNewspaperLead } from "../../../supabase/functions/_shared/newspaperHeadline";

export type PaperVariant = "timeline" | "story" | "ledger" | "essay" | "pending";

export interface PaperModule {
  key: string;
  section: NewspaperSectionId | "pending";
  title: string;
  kicker: string;
  variant: PaperVariant;
  items: NewspaperEntry[];
  figures: NewspaperImageAsset[];
}

export interface PaperLayout {
  lead: NewspaperEntry | null;
  leadSection: NewspaperSectionId | null;
  modules: PaperModule[];
  total: number;
  completed: number;
  planned: number;
}

const VARIANT: Record<NewspaperSectionId, PaperVariant> = {
  chronicle: "timeline",
  learning: "story",
  finance: "ledger",
  health: "ledger",
  thoughts: "essay",
};
const KICKER: Record<NewspaperSectionId | "pending", string> = {
  chronicle: "纪事",
  learning: "成长",
  finance: "账目",
  health: "起居",
  thoughts: "随笔",
  pending: "待续",
};

const byTime = (a: NewspaperEntry, b: NewspaperEntry) =>
  (a.time ? Date.parse(a.time) : Number.MAX_SAFE_INTEGER) -
  (b.time ? Date.parse(b.time) : Number.MAX_SAFE_INTEGER);

export function pickLead(report: NewspaperReport) {
  return pickNewspaperLead(report.snapshot.sections, report.hidden_sections);
}

export function buildPaperLayout(report: NewspaperReport): PaperLayout {
  const lead = pickLead(report);
  const visible = report.snapshot.sections.filter((s) =>
    !report.hidden_sections.includes(s.id)
  );
  const pending: NewspaperEntry[] = [];
  const modules: PaperModule[] = [];
  for (const section of visible) {
    const items = section.items.filter((e) => {
      if (lead && e.id === lead.entry.id) return false;
      if (e.status === "planned") {
        pending.push(e);
        return false;
      }
      return true;
    });
    const figures = report.assets.filter((a) =>
      a.section_id === section.id && a.active
    );
    if (!items.length && !figures.length) continue;
    const variant = VARIANT[section.id];
    modules.push({
      key: section.id,
      section: section.id,
      title: section.title,
      kicker: KICKER[section.id],
      variant,
      items: section.id === "chronicle" ? [...items].sort(byTime) : items,
      figures,
    });
  }
  if (pending.length) {
    const index = modules.findIndex((m) => m.section === "chronicle");
    modules.splice(index < 0 ? 0 : index + 1, 0, {
      key: "pending",
      section: "pending",
      title: "尚未完成",
      kicker: KICKER.pending,
      variant: "pending",
      items: [...pending].sort(byTime),
      figures: [],
    });
  }
  const all = visible.flatMap((s) => s.items);
  return {
    lead: lead?.entry ?? null,
    leadSection: lead?.section ?? null,
    modules,
    total: all.length,
    completed: all.filter((e) => e.status === "completed").length,
    planned: pending.length,
  };
}
