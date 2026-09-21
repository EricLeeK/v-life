import { describe, expect, it, vi } from 'vitest';
import { createAgentDataService } from './agentDataService';
function dbMock(result: any = {data: []}) {
 const calls: any[] = []; const q: any = {};
 for (const m of ['select','eq','in','ilike','order','range','limit','insert','update','delete','upsert']) q[m] = (...args: any[]) => {calls.push([m,...args]); return q};
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
