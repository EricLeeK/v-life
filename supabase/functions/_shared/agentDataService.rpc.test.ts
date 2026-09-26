import { describe, expect, it, vi } from 'vitest';
import { createAgentDataService } from './agentDataService';
function dbMock(result: any = {data: []}) {
 const calls: any[] = []; const q: any = {};
 for (const m of ['select','eq','gte','lte','lt','in','ilike','order','range','limit','insert','update','delete','upsert']) q[m] = (...args: any[]) => {calls.push([m,...args]); return q};
 q.then = (resolve: any) => Promise.resolve(result).then(resolve); q.maybeSingle = async () => result; q.single = async () => result;
 return {from: vi.fn(() => q),rpc:vi.fn(async()=>({data:{data:{id:'a',title:'ok',user_id:'secret'}},error:null})),calls};
}
const ctx = (db: any) => ({db,userId:'u',clientId:'c',requestId:'req',toolName:'todo_create',idempotencyKey:'key',permissions:{read:true,write:true,delete:true}});
describe('agent RPC and paging',()=>{
 it('routes mutations through atomic RPC without supplied identity and forwards metadata',async()=>{
  const db=dbMock(); const result=await createAgentDataService(ctx(db)).create('todo',{title:'ok'});
  expect(db.rpc).toHaveBeenCalledWith('agent_mutate',{p_module:'todo',p_operation:'create',p_record_id:null,p_payload:{title:'ok'},p_idempotency_key:'key',p_request_id:'req',p_tool_name:'todo_create'});
  expect(result.data).toEqual({id:'a',title:'ok'}); expect(db.from).not.toHaveBeenCalled();
 });
 it('uses stable offset paging with explicit next page',async()=>{
  const db=dbMock({data:[{id:'2'},{id:'3'},{id:'4'}]});
  const result=await createAgentDataService(ctx(db)).list('todo',{limit:2,offset:1});
  expect(result).toMatchObject({data:[{id:'2'},{id:'3'}],hasMore:true,nextOffset:3});
  expect(db.calls).toContainEqual(['order','id',{ascending:true}]); expect(db.calls).toContainEqual(['range',1,3]);
 });
 it('returns exact summary count',async()=>{
  const db=dbMock({data:null,count:300}); const result=await createAgentDataService(ctx(db)).summary('todo');
  expect(result.data.count).toBe(300); expect(db.calls).toContainEqual(['select','id',{count:'exact',head:true}]);
 });
 it('rejects invalid enum, date, array, non-finite numbers and empty updates',async()=>{
  const s=createAgentDataService(ctx(dbMock()));
  for(const data of [{title:'a',kind:'bad'},{title:12}]) await expect(s.create('todo',data)).rejects.toMatchObject({code:'INVALID_INPUT'});
  await expect(s.create('thought',{content:'x',tags:'not array'})).rejects.toMatchObject({code:'INVALID_INPUT'});
  await expect(s.create('weight',{weight:Infinity,date:'2026-02-30'})).rejects.toMatchObject({code:'INVALID_INPUT'});
  await expect(s.update('todo','x',{})).rejects.toMatchObject({code:'INVALID_INPUT'});
 });
 it('does not read settings for agent finance writes',async()=>{
  const db=dbMock(); await createAgentDataService(ctx(db)).create('finance',{name:'a',amount:10,currency:'JPY',category:'餐饮',date:'2026-09-21'});
  expect(db.from).not.toHaveBeenCalled(); expect(db.rpc.mock.calls[0][1].p_payload).not.toHaveProperty('exchange_rate');
 });
});

describe('daily task workflow',()=>{
 it('adds an existing todo without requiring a title through the atomic RPC',async()=>{
  const db=dbMock();
  await createAgentDataService(ctx(db)).create('daily_task',{todo_id:'bd240000-0000-4000-8000-000000000001'});
  expect(db.rpc).toHaveBeenCalledWith('agent_mutate',expect.objectContaining({p_module:'daily_task',p_operation:'create',p_payload:{todo_id:'bd240000-0000-4000-8000-000000000001'}}));
 });
 it('creates a named task and completes daily tasks through the domain RPC',async()=>{
  const db=dbMock(); const s=createAgentDataService(ctx(db));
  await s.create('daily_task',{title:'new today',kind:'once'});
  await s.update('daily_task','daily-id',{is_completed:true});
  expect(db.rpc).toHaveBeenLastCalledWith('agent_mutate',expect.objectContaining({p_module:'daily_task',p_operation:'update',p_payload:{is_completed:true}}));
 });
 it('lists only stored daily fields and validates inputs',async()=>{
  const db=dbMock({data:[]}); const s=createAgentDataService(ctx(db));
  await s.list('daily_task');
  expect(db.calls.find(c=>c[0]==='select')?.[1].split(',')).not.toContain('title');
  await expect(s.create('daily_task',{})).rejects.toMatchObject({code:'INVALID_INPUT'});
  await expect(s.update('daily_task','id',{todo_id:'other'})).rejects.toMatchObject({code:'FIELD_NOT_ALLOWED'});
 });
});

describe('agent date semantics',()=>{
 it('rejects a reversed date range before querying records',async()=>{
  const db=dbMock();
  await expect(createAgentDataService(ctx(db)).list('finance',{date_from:'2026-09-25',date_to:'2026-09-24'})).rejects.toMatchObject({code:'INVALID_INPUT'});
 });
 it('includes the entire final day when filtering timestamp-backed schedules',async()=>{
  const db=dbMock();
  await createAgentDataService(ctx(db)).list('schedule',{date_from:'2026-09-24',date_to:'2026-09-24'});
  expect(db.calls).toContainEqual(['gte','start_time','2026-09-24T00:00:00+08:00']);
  expect(db.calls).toContainEqual(['lt','start_time','2026-09-25T00:00:00+08:00']);
 });
});

describe('agent classification discovery',()=>{
 it('uses the aggregate RPC and reports open vocabulary policy',async()=>{
  const db=dbMock();db.rpc.mockResolvedValue({data:{data:[{value:'工作',usage_count:3,configured:false}],total:1,hasMore:false,nextOffset:null},error:null});
  const r=await createAgentDataService(ctx(db)).classifications('daily_task');
  expect(db.rpc).toHaveBeenCalledWith('agent_classifications',{p_module:'daily_task',p_limit:50,p_offset:0});
  expect(r).toMatchObject({allow_new:true,source_module:'todo',field:'category',data:[{value:'工作',writable:true}]});
 });
 it('keeps closed categories closed and does not hide database errors as empty lists',async()=>{
  const db=dbMock();db.rpc.mockResolvedValue({data:{data:[{value:'旧分类',usage_count:1}],total:1,hasMore:false},error:null});
  const r=await createAgentDataService(ctx(db)).classifications('finance');
  expect(r.allow_new).toBe(false);expect(r.presets).toContain('餐饮');expect(r.data[0].writable).toBe(false);
  db.rpc.mockResolvedValue({data:null,error:{message:'unavailable'}});
  await expect(createAgentDataService(ctx(db)).classifications('todo')).rejects.toMatchObject({code:'DATABASE_ERROR'});
 });
 it('requires read permission and only permits classification modules and valid pagination',async()=>{
  const db=dbMock();const context=ctx(db);context.permissions.read=false;
  await expect(createAgentDataService(context).classifications('todo')).rejects.toMatchObject({code:'PERMISSION_DENIED'});
  context.permissions.read=true;
  await expect(createAgentDataService(context).classifications('settings')).rejects.toMatchObject({code:'INVALID_INPUT'});
  await expect(createAgentDataService(context).classifications('todo',{limit:201})).rejects.toMatchObject({code:'INVALID_INPUT'});
  expect(db.rpc).not.toHaveBeenCalled();
 });
});

describe('todo completion evidence',()=>{
 it('reads completion timestamps and filters a full Beijing calendar day',async()=>{
  const db=dbMock({data:[{id:'today',is_completed:true,completed_at:'2026-09-24T04:00:00Z'}]});
  const result=await createAgentDataService(ctx(db)).list('todo',{filters:{is_completed:true},date_from:'2026-09-24',date_to:'2026-09-24'});
  expect(result.data[0].completed_at).toBe('2026-09-24T04:00:00Z');
  expect(db.calls.find(c=>c[0]==='select')?.[1].split(',')).toContain('completed_at');
  expect(db.calls).toContainEqual(['gte','completed_at','2026-09-24T00:00:00+08:00']);
  expect(db.calls).toContainEqual(['lt','completed_at','2026-09-25T00:00:00+08:00']);
 });
 it('does not allow callers to fabricate completion timestamps',async()=>{
  const s=createAgentDataService(ctx(dbMock()));
  await expect(s.create('todo',{title:'a',completed_at:'2026-09-24T04:00:00Z'})).rejects.toMatchObject({code:'FIELD_NOT_ALLOWED'});
  await expect(s.update('todo','a',{completed_at:'2026-09-24T04:00:00Z'})).rejects.toMatchObject({code:'FIELD_NOT_ALLOWED'});
 });
});
