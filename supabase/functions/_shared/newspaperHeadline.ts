import type { NewspaperEntry, NewspaperSectionId, NewspaperSnapshot } from './newspaperTypes.ts';

/** The front-page story: the richest finished thing of the day, else the richest record. Plans never lead. */
export function pickNewspaperLead(
  sections: NewspaperSnapshot['sections'],
  hidden: string[] = [],
): { entry: NewspaperEntry; section: NewspaperSectionId } | null {
  const rank = (e: NewspaperEntry) =>
    (e.status === 'completed' ? 2000 : 1000) + Math.min(e.body.length, 900) + (e.title.length > 4 ? 40 : 0);
  let best: { entry: NewspaperEntry; section: NewspaperSectionId } | null = null;
  for (const section of sections) {
    if (hidden.includes(section.id) || section.id === 'finance' || section.id === 'health') continue;
    for (const entry of section.items) {
      if (entry.status === 'planned') continue;
      if (!best || rank(entry) > rank(best.entry)) best = { entry, section: section.id };
    }
  }
  return best;
}

/** Spine text for the archive: the lead headline plus the next few titles. */
export function newspaperSpine(sections: NewspaperSnapshot['sections']) {
  const lead = pickNewspaperLead(sections);
  const rest = sections.flatMap((s) => s.items).filter((e) => e.id !== lead?.entry.id);
  return {
    title: lead?.entry.title || rest[0]?.title || '平静的一天',
    excerpt: rest.slice(0, 3).map((e) => e.title).join(' · ') || (lead ? lead.entry.body.slice(0, 60) : '这一天还没有记录'),
  };
}
