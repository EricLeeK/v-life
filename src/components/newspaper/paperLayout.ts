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
  /** Columns out of 12; rows are packed so every row sums to 12. */
  span: number;
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

/** Rough column demand: ledgers stay narrow, long prose asks for width. */
function preferredSpan(
  variant: PaperVariant,
  items: NewspaperEntry[],
  figures: number,
): 4 | 6 | 8 {
  if (variant === "ledger" || variant === "pending") {
    return items.length > 8 ? 6 : 4;
  }
  const weight = items.length +
    items.reduce((n, e) => n + e.body.length, 0) / 320 + figures * 2;
  if (weight >= 7) return 8;
  if (weight >= 3) return 6;
  return 4;
}

export function pickLead(report: NewspaperReport) {
  return pickNewspaperLead(report.snapshot.sections, report.hidden_sections);
}

/** Fill each 12-column row exactly by widening the row's last modules. */
export function packRows<T extends { span: number }>(
  modules: T[],
  columns = 12,
): T[][] {
  const rows: T[][] = [];
  let row: T[] = [];
  let used = 0;
  const close = () => {
    if (!row.length) return;
    let spare = columns - used;
    for (let i = row.length - 1; spare > 0; i = i > 0 ? i - 1 : row.length - 1) {
      const grow = Math.min(spare, row.length === 1 ? spare : 2);
      row[i] = { ...row[i], span: row[i].span + grow };
      spare -= grow;
    }
    rows.push(row);
    row = [];
    used = 0;
  };
  const queue = [...modules];
  while (queue.length) {
    const fit = queue.findIndex((m) => used + m.span <= columns);
    if (fit < 0) {
      close();
      continue;
    }
    const [module] = queue.splice(fit, 1);
    row.push({ ...module });
    used += module.span;
    if (used === columns) close();
  }
  close();
  return rows;
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
      span: preferredSpan(variant, items, figures.length),
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
      span: 4,
    });
  }
  const all = visible.flatMap((s) => s.items);
  return {
    lead: lead?.entry ?? null,
    leadSection: lead?.section ?? null,
    modules: packRows(modules).flat() as PaperModule[],
    total: all.length,
    completed: all.filter((e) => e.status === "completed").length,
    planned: pending.length,
  };
}
