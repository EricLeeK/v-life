import { describe, expect, it, vi } from 'vitest';
import { createAgentDataService } from './agentDataService';
import { moduleByKey } from './moduleRegistry';
import { schemaForField, validateToolInput } from '../mcp-server/toolSchema';

const pairs = [['早餐', 'breakfast'], ['午餐', 'lunch'], ['晚餐', 'dinner'], ['加餐', 'snack'], ['运动', 'exercise']];
const field = moduleByKey.calories.fields.find(f => f.name === 'meal_type')!;
function setup() {
  const rpc = vi.fn(async () => ({ data: { data: { id: 'record' } }, error: null }));
  const q: any = {};
  for (const m of ['select', 'eq', 'order', 'range']) q[m] = vi.fn(() => q);
  q.then = (resolve: any) => Promise.resolve({ data: [] }).then(resolve);
  const service = createAgentDataService({ db: { rpc, from: () => q } as any, userId: 'u', clientId: 'c', idempotencyKey: 'key', permissions: { read: true, write: true, delete: true } });
  return { service, rpc, q };
}
describe('calorie meal type aliases', () => {
  it.each(pairs)('accepts %s in MCP and persists %s for create/update/filter', async (alias, canonical) => {
    validateToolInput(schemaForField(field), alias);
    const { service, rpc, q } = setup();
    const input = { food_name: 'test', calories: 200, meal_type: alias, date: '2026-09-25' };
    await service.create('calories', input);
    expect(rpc.mock.calls[0]).toEqual(['agent_mutate', expect.objectContaining({ p_payload: { ...input, meal_type: canonical } })]);
    expect(input.meal_type).toBe(alias);
    await service.update('calories', 'record', { meal_type: alias });
    expect(rpc.mock.calls[1]).toEqual(['agent_mutate', expect.objectContaining({ p_payload: { meal_type: canonical } })]);
    await service.list('calories', { filters: { meal_type: alias } });
    expect(q.eq).toHaveBeenCalledWith('meal_type', canonical);
  });
  it.each(pairs)('keeps canonical %s / %s supported', async (_, canonical) => {
    validateToolInput(schemaForField(field), canonical);
    const { service, rpc } = setup();
    await service.create('calories', { food_name: 'test', calories: 200, meal_type: canonical, date: '2026-09-25' });
    expect(rpc.mock.calls[0]).toEqual(['agent_mutate', expect.objectContaining({ p_payload: expect.objectContaining({ meal_type: canonical }) })]);
  });
  it.each(['未知', 'toString', '', 1, null])('rejects invalid meal type %s without writing', async value => {
    expect(() => validateToolInput(schemaForField(field), value)).toThrow();
    const { service, rpc } = setup();
    await expect(service.create('calories', { food_name: 'test', calories: 200, meal_type: value, date: '2026-09-25' })).rejects.toMatchObject({ code: 'INVALID_INPUT' });
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe('positive calorie amounts', () => {
  it.each([-200, 0])('rejects %s with an actionable hint on create and partial update', async calories => {
    const amount = moduleByKey.calories.fields.find(f => f.name === 'calories')!;
    expect(() => validateToolInput(schemaForField(amount), calories)).toThrow(/200/);
    const { service, rpc } = setup();
    await expect(service.create('calories', { food_name: '跑步', calories, meal_type: '运动', date: '2026-09-25' })).rejects.toThrow(/正数/);
    await expect(service.update('calories', 'record', { calories })).rejects.toThrow(/正数/);
    expect(rpc).not.toHaveBeenCalled();
  });
  it('advertises a positive number with exercise deduction explained', () => {
    const schema = schemaForField(moduleByKey.calories.fields.find(f => f.name === 'calories')!);
    expect(schema.exclusiveMinimum).toBe(0);
    expect(schema.description).toContain('200');
    expect(schema.description).toContain('系统');
  });
});
