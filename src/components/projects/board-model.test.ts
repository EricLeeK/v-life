import { describe, expect, it } from 'vitest';
import { moveProjectItem, projectProgress, resolveCover, type BoardItem } from './board-model';

const item = (id: string, status = 'todo', type = 'task', sort_order = 0): BoardItem => ({ id, status, type, sort_order, weight: 1 });
describe('project board movement', () => {
  it('keeps hidden habits in order when moving within a task-only filter', () => {
    const rows = [item('a'), item('h', 'todo', 'habit', 1), item('b', 'todo', 'task', 2)];
    const next = moveProjectItem(rows, 'b', 'todo', 0, ['a', 'b']);
    expect(next.filter(x => x.status === 'todo').sort((a,b) => a.sort_order-b.sort_order).map(x => x.id)).toEqual(['b','a','h']);
    expect(next.every(x => x.sort_order >= 0)).toBe(true);
    expect(rows[2].sort_order).toBe(2);
  });
  it('renumbers both source and destination without losing cards', () => {
    const rows = [item('a'), item('b','todo','task',1),item('c','done')];
    const next = moveProjectItem(rows,'a','done',1,['a','b','c']);
    expect(next.find(x=>x.id==='a')).toMatchObject({status:'done',sort_order:1});
    expect(next.find(x=>x.id==='b')?.sort_order).toBe(0);
    expect(next).toHaveLength(3);
  });
  it('accepts an empty destination and rejects unknown statuses or IDs', () => {
    const rows=[item('a')];
    expect(moveProjectItem(rows,'a','waiting',0,['a'])[0].status).toBe('waiting');
    expect(moveProjectItem(rows,'a','unknown',0,['a'])).toEqual(rows);
    expect(moveProjectItem(rows,'missing','done',0,['a'])).toEqual(rows);
  });
  it('excludes habits and uses real weights for progress', () => {
    expect(projectProgress([{...item('a','done'),weight:3},item('b'),item('h','todo','habit')])).toBe(75);
    expect(projectProgress([item('h','done','habit')])).toBe(0);
    expect(projectProgress([{...item('a','done'),weight:0},item('b')])).toBe(0);
  });
  it('uses a sage milestone cover by default and allows explicitly disabling it', () => {
    expect(resolveCover({type:'milestone'})).toBe('sage');
    expect(resolveCover({type:'task'})).toBe('none');
    expect(resolveCover({type:'milestone',cover_preset:'none'})).toBe('none');
    expect(resolveCover({type:'task',cover_preset:'mist'})).toBe('mist');
    expect(resolveCover({type:'task',cover_preset:'bad'})).toBe('none');
  });
});
