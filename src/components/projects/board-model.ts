export const projectColumns = [
  { id: 'todo', zh: '待办', en: 'To do' },
  { id: 'this_week', zh: '本周', en: 'This week' },
  { id: 'in_progress', zh: '进行中', en: 'In progress' },
  { id: 'waiting', zh: '等待中', en: 'Waiting' },
  { id: 'done', zh: '已完成', en: 'Done' },
] as const;
export const coverPresets = [
  { id: 'auto', zh: '自动', en: 'Auto' },
  { id: 'none', zh: '无封面', en: 'None' },
  { id: 'sage', zh: '鼠尾草', en: 'Sage' },
  { id: 'sand', zh: '暖沙', en: 'Sand' },
  { id: 'clay', zh: '陶土', en: 'Clay' },
  { id: 'mist', zh: '雾蓝', en: 'Mist' },
  { id: 'iris', zh: '鸢尾', en: 'Iris' },
  { id: 'ocean', zh: '海盐', en: 'Sea salt' },
  { id: 'rose', zh: '玫瑰纸', en: 'Rose paper' },
  { id: 'graphite', zh: '石墨', en: 'Graphite' },
  { id: 'honey', zh: '琥珀', en: 'Amber' },
] as const;
export type CoverPreset = typeof coverPresets[number]['id'];
export interface BoardItem { id: string; status: string; type: string; weight: number; sort_order: number; created_at?: string | null }
export const byBoardOrder = (a: BoardItem, b: BoardItem) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || String(a.created_at ?? '').localeCompare(String(b.created_at ?? '')) || a.id.localeCompare(b.id);
export function resolveCover(item: { type: string; cover_preset?: string | null }): CoverPreset {
  const selected = item.cover_preset;
  if (selected && selected !== 'auto' && coverPresets.some(p => p.id === selected)) return selected as CoverPreset;
  return item.type === 'milestone' ? 'sage' : 'none';
}
export function projectProgress(items: Pick<BoardItem, 'type'|'weight'|'status'>[]) {
  const countable = items.filter(item => item.type !== 'habit');
  const total = countable.reduce((sum,item) => sum + item.weight, 0);
  const done = countable.filter(item => item.status === 'done').reduce((sum,item) => sum + item.weight, 0);
  return total ? Math.round(done / total * 100) : 0;
}
/** Visible index is mapped back to the complete column, so filtering never assigns hidden rows -1. */
export function moveProjectItem<T extends BoardItem>(items: T[], id: string, status: string, index: number, visibleIds: string[]): T[] {
  const moved = items.find(item => item.id === id);
  if (!moved || !projectColumns.some(column => column.id === status)) return items;
  const dest = items.filter(item => item.status === status && item.id !== id).sort(byBoardOrder);
  const visible = dest.filter(item => visibleIds.includes(item.id));
  const at = Math.max(0, Math.min(index, visible.length));
  const anchor = visible[at];
  const previous = visible[at - 1];
  const insert = anchor ? dest.findIndex(item => item.id === anchor.id) : previous ? dest.findIndex(item => item.id === previous.id) + 1 : dest.length;
  dest.splice(insert, 0, { ...moved, status });
  const updates = new Map(dest.map((item,sort_order) => [item.id, { ...item, sort_order }]));
  if (moved.status !== status) items.filter(item => item.status === moved.status && item.id !== id).sort(byBoardOrder).forEach((item,sort_order) => updates.set(item.id,{ ...item,sort_order }));
  return items.map(item => updates.get(item.id) ?? item);
}
