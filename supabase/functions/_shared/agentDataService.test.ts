import { describe, expect, it } from "vitest";
import { createAgentDataService, AgentDataError } from "./agentDataService";

function fakeDb(result: { data?: unknown; error?: { message: string; code?: string } }) {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const builder: any = {
    select: (...args: unknown[]) => { calls.push({ method: "select", args }); return builder; },
    eq: (...args: unknown[]) => { calls.push({ method: "eq", args }); return builder; },
    ilike: (...args: unknown[]) => { calls.push({ method: "ilike", args }); return builder; },
    order: (...args: unknown[]) => { calls.push({ method: "order", args }); return builder; },
    range: (...args: unknown[]) => { calls.push({ method: "range", args }); return builder; },
    limit: (...args: unknown[]) => { calls.push({ method: "limit", args }); return builder; },
    single: async () => result,
    maybeSingle: async () => result,
    then: (resolve: (x: unknown) => unknown) => Promise.resolve(result).then(resolve),
  };
  return { calls, from: () => builder } as any;
}

const context = (db: any, permissions = { read: true, write: true, delete: true }) =>
  ({ db, userId: "user-a", permissions });

describe("agent data service", () => {
  it("projects list results to registered read fields", async () => {
    const db = fakeDb({ data: [{ id: "1", title: "x", detail: "ok", user_id: "user-a", secret: "no" }] });
    const service = createAgentDataService(context(db));
    const result = await service.list("todo");
    expect(result.data).toEqual([{ id: "1", title: "x", detail: "ok" }]);
    expect(db.calls.find((c) => c.method === "select")?.args[0]).not.toBe("*");
  });

  it("rejects caller supplied user_id", async () => {
    const service = createAgentDataService(context(fakeDb({ data: [] })));
    await expect(service.create("todo", { title: "x", user_id: "other" })).rejects.toMatchObject({ code: "USER_ID_FORBIDDEN" });
  });

  it("enforces operation permissions", async () => {
    const service = createAgentDataService(context(fakeDb({ data: [] }), { read: false, write: false, delete: false }));
    await expect(service.list("todo")).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    await expect(service.create("todo", { title: "x" })).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    await expect(service.delete("todo", "1")).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
  });

  it("reports ambiguous relation matches instead of choosing one", async () => {
    const db = fakeDb({ data: [{ id: "1" }, { id: "2" }] });
    const service = createAgentDataService(context(db));
    await expect(service.create("todo", { title: "child", parent_title: "same" })).rejects.toMatchObject({ code: "RELATION_AMBIGUOUS" });
  });

  it("returns structured unknown module errors", async () => {
    const service = createAgentDataService(context(fakeDb({ data: [] })));
    await expect(service.list("missing")).rejects.toBeInstanceOf(AgentDataError);
  });
});

import { agentMetaOf, moduleByKey } from './moduleRegistry';
describe('agent contract regression', () => {
  it('separates create fields and real read columns', () => {
    expect(agentMetaOf(moduleByKey.finance).createFields).toContain('date');
    expect(agentMetaOf(moduleByKey.project_task).createFields).toContain('project_name');
    expect(agentMetaOf(moduleByKey.todo).readFields).not.toContain('parent_title');
    expect(agentMetaOf(moduleByKey.todo).readFields).toContain('parent_id');
  });
  it('rejects invalid field types and missing required fields', async () => {
    const s = createAgentDataService(context(fakeDb({data: []})));
    await expect(s.create('todo', {title: 123})).rejects.toMatchObject({code:'INVALID_INPUT'});
    await expect(s.create('todo', {})).rejects.toMatchObject({code:'INVALID_INPUT'});
    await expect(s.update('belongings_daily', '1', {name:'x'})).rejects.toMatchObject({code:'ACTION_NOT_ALLOWED'});
  });
  it('scopes every directly owned table', async () => {
    const db = fakeDb({data: []});
    await createAgentDataService(context(db)).list('todo');
    expect(db.calls).toContainEqual({method:'eq', args:['user_id','user-a']});
  });
});

it('routes OAuth writes through the atomic user-context RPC', async () => {
  const calls: any[] = [];
  const db: any = { rpc: async (name: string, args: any) => { calls.push({name,args}); return { data:{data:{id:'r1',title:'test'}},error:null }; } };
  const service=createAgentDataService({...context(db),clientId:'client',idempotencyKey:'retry',requestId:'request'});
  expect((await service.create('todo',{title:'test'})).data.id).toBe('r1');
  expect(calls[0].name).toBe('agent_mutate');
  expect(calls[0].args.p_idempotency_key).toBe('retry');
  expect(calls[0].args.p_payload).not.toHaveProperty('user_id');
});
