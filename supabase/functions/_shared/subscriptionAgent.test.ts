import { describe, expect, it, vi } from 'vitest';
import { moduleByKey, buildSystemPrompt, allQueryKeys } from './moduleRegistry';
import { createAgentDataService } from './agentDataService';
import { fieldsSchema } from '../mcp-server/mcpAdapter';
import { listSchema, validateToolInput } from '../mcp-server/toolSchema';
import { buildOpenApi, parseApiListOptions } from '../agent-api/apiAdapter';
import { classificationPolicy } from './agentClassifications';
import { normalizeSubscription, normalizeSubscriptionPayment, subscriptionCalendarDate } from './subscriptionOperations';
import { fetchUserVocab, formatUserVocabBlock } from './userVocab';
import { listModuleRecords } from './dataReader';
import { contractSql } from '../../../scripts/agent-contract';

const subId='11111111-1111-4111-8111-111111111111';
const create={name:'Cloud',amount:20,currency:'USD',next_date:'2026-10-31'};
const pay={subscription_id:subId,due_date:'2026-09-25',paid_on:'2026-09-25',amount:20,next_date:'2026-10-25'};
function fixture(write=true) {
 const calls:unknown[][]=[]; const q:any={};
 for(const m of ['select','eq','is','gte','lte','order','range','in'])q[m]=(...args:unknown[])=>{calls.push([m,...args]);return q;};
 q.then=(resolve:any)=>Promise.resolve({data:[{id:subId,...normalizeSubscription(create)}],error:null}).then(resolve);
 const db:any={from:vi.fn(()=>q),rpc:vi.fn(async(name:string,args:any)=>({data:name==='agent_mutate'?{data:{id:subId,...args.p_payload}}:{id:'payment',subscription_id:subId,period_date:pay.due_date,amount:20,currency:'USD',user_id:'secret'},error:null}))};
 return {db,calls,service:createAgentDataService({db,userId:'u',clientId:'c',permissions:{read:true,write,delete:true}})};
}
describe('subscription agent contract',()=>{
 it('publishes CRUD, payment history, date filtering, and open classifications on every schema surface',()=>{
  const sub=moduleByKey.subscription,payment=moduleByKey.subscription_payment;
  expect(sub).toBeDefined();expect(payment).toBeDefined();
  expect(sub.executor?.dateField).toBe('next_date');expect(allQueryKeys()).toContain('subscriptions');
  expect(classificationPolicy('subscription')).toMatchObject({allow_new:true,field:'category'});
  expect(listSchema(payment).properties).toHaveProperty('period_date');
  expect(listSchema(payment).properties).not.toHaveProperty('due_date');
  const api:any=buildOpenApi('https://example.test','https://auth.test');
  expect(api.paths['/subscription'].post).toBeDefined();expect(api.paths['/subscription_payment'].post).toBeDefined();
  expect(api.paths['/subscription_payment/{id}'].patch).toBeUndefined();
  expect(api.paths['/subscription_payment'].get.parameters).toContainEqual(expect.objectContaining({name:'subscription_id',in:'query',schema:expect.objectContaining({type:'string',format:'uuid'})}));
  expect(buildSystemPrompt()).toContain('外部');
 });
 it('validates nonnegative amounts, integer cycles and nullable reminders at the actual tool boundary',()=>{
  const schema=fieldsSchema(moduleByKey.subscription,'create');
  expect(()=>validateToolInput(schema,{...create,reminder_days:null})).not.toThrow();
  for(const invalid of [{amount:-1},{billing_interval:1.5},{billing_interval:0},{anchor_day:32},{reminder_days:-1},{next_date:'2026-02-30'}])
   expect(()=>validateToolInput(schema,{...create,...invalid})).toThrow();
 });
 it('routes valid CRUD through atomic mutation without accepting fabricated payment rows',async()=>{
  const {db,service}=fixture();const result=await service.create('subscription',create);
  expect(result.data).toMatchObject(create);expect(db.rpc).toHaveBeenCalledWith('agent_mutate',expect.objectContaining({p_module:'subscription',p_payload:expect.objectContaining(create)}));
  await expect(service.update('subscription_payment','payment',{amount:3})).rejects.toMatchObject({code:'ACTION_NOT_ALLOWED'});
 });
 it('rejects invalid values even without MCP schema validation',async()=>{
  const {db,service}=fixture();
  for(const bad of [{amount:-1},{amount:'20'},{amount:1e12+1},{billing_interval:0},{billing_interval:1.5},{billing_interval:121},{billing_unit:'day',billing_interval:3661},{anchor_day:32},{reminder_days:-1},{reminder_days:366},{url:'javascript:alert(1)'}])
   await expect(service.create('subscription',{...create,...bad})).rejects.toMatchObject({code:'INVALID_INPUT'});
  expect(db.rpc).not.toHaveBeenCalled();
 });
 it('executes confirmation with the dedicated RPC and redacts ownership',async()=>{
  const {db,service}=fixture();const r=await service.create('subscription_payment',pay);
  expect(db.rpc).toHaveBeenCalledWith('confirm_subscription_payment',{p_subscription_id:subId,p_due_date:pay.due_date,p_paid_on:pay.paid_on,p_amount:20,p_next_date:pay.next_date,p_record_expense:false,p_exchange_rate:null});
  expect(r.data).not.toHaveProperty('user_id');expect(r.data).toHaveProperty('period_date',pay.due_date);
 });
 it('never bypasses denied write permission for confirmation or finance creation',async()=>{
  const {db,service}=fixture(false);
  await expect(service.create('subscription_payment',{...pay,record_expense:true,exchange_rate:7})).rejects.toMatchObject({code:'PERMISSION_DENIED'});
  expect(db.rpc).not.toHaveBeenCalled();
 });
 it('rejects incomplete and stale-shaped payment commands before a database write',async()=>{
  const {db,service}=fixture();
  for(const bad of [{amount:-1},{next_date:pay.due_date},{subscription_id:'guessed'},{exchange_rate:0},{record_expense:'true'}])
   await expect(service.create('subscription_payment',{...pay,...bad})).rejects.toMatchObject({code:'INVALID_INPUT'});
  expect(db.rpc).not.toHaveBeenCalled();
 });
 it('queries upcoming subscriptions by real renewal dates and payment history by subscription ID',async()=>{
  const {service,calls}=fixture();await service.list('subscription',{date_from:'2026-09-25',date_to:'2026-10-02',filters:{status:'active'}});
  expect(calls).toContainEqual(['gte','next_date','2026-09-25']);expect(calls).toContainEqual(['lte','next_date','2026-10-02']);
  await service.list('subscription_payment',{filters:{subscription_id:subId}});
  expect(calls).toContainEqual(['eq','subscription_id',subId]);
 });
 it('preserves defaults, open categories, explicit null reminders and user confirmed values',()=>{
  const row=normalizeSubscription({...create,reminder_days:null,category:'创作',billing_interval:12,amount:119.99});
  expect(row).toMatchObject({amount:119.99,currency:'USD',anchor_day:31,reminder_days:null,category:'创作',billing_interval:12,auto_renew:true});
  expect(normalizeSubscription({amount:100},{...row,id:subId,user_id:'u'})).not.toHaveProperty('user_id');
  expect(normalizeSubscription({amount:100},{...row,url:null,notes:null,plan:null})).toMatchObject({url:null,notes:null,plan:null,amount:100});
  expect(normalizeSubscriptionPayment(pay)).toMatchObject({...pay,record_expense:false});
  expect(normalizeSubscription({...create,name:' Cloud ',category:' 创作 ',url:''})).toMatchObject({name:'Cloud',category:'创作',url:null});
 });
 it('loads subscription vocabulary for the website assistant',async()=>{
  const db:any={from:(table:string)=>({select:()=>({order:()=>({limit:async()=>({data:table==='subscriptions'?[{category:'创作'},{category:'创作'}]:[],error:null})})})})};
  const vocab=await fetchUserVocab(db);
  expect(formatUserVocabBlock(vocab)).toContain('subscription.category: 创作');
 });
 it('uses shared per-currency summaries with every page and no invented exchange rate',async()=>{
  const {service}=fixture();
  const result=await service.subscriptionSummary('2026-10-01');
  expect(result.data).toMatchObject({as_of_date:'2026-10-01',monthly:{USD:20},estimatedMonthly:{}});
  expect(result.data).not.toHaveProperty('total_cny');
 });
 it('web AI queries payment UUIDs with equality rather than invalid UUID ilike',async()=>{
  const calls:any[]=[];const q:any={};for(const method of ['select','eq','ilike','order','limit'])q[method]=(...args:any[])=>{calls.push([method,...args]);return q;};q.then=(resolve:any)=>Promise.resolve({data:[],error:null}).then(resolve);
  await listModuleRecords({from:()=>q} as any,'subscription_payment',{filters:{subscription_id:subId,period_date:'2026-09-25'}});
  expect(calls).toContainEqual(['eq','subscription_id',subId]);expect(calls).toContainEqual(['eq','period_date','2026-09-25']);
 });
 it('cannot reopen raw payment insert permissions when regenerating database contracts',()=>{
  const line=contractSql().split('\n').find(sql=>sql.includes("('subscription_payment'"))!;
  const contract=JSON.parse(line.slice(line.indexOf("','")+3,line.lastIndexOf("') on conflict")));
  expect(contract.actions).toEqual({});expect(contract.createColumns).toEqual([]);expect(contract.updateColumns).toEqual([]);
 });
 it('filters disabled reminders with SQL IS NULL rather than returning every subscription',async()=>{
  const {service,calls}=fixture();await service.list('subscription',{filters:{reminder_days:null}});
  expect(calls).toContainEqual(['is','reminder_days',null]);
 });
 it('only parses HTTP null filter values for nullable module fields',()=>{
  const opts=parseApiListOptions(new URL('https://example.test/subscription?reminder_days=null&name=null'),'subscription');
  expect(opts.filters).toEqual({reminder_days:null,name:'null'});
 });
 it('uses Beijing calendar dates at the UTC day boundary for prompts and payment summaries',()=>{
  expect(subscriptionCalendarDate(new Date('2026-09-25T16:00:00Z'))).toBe('2026-09-26');
  expect(subscriptionCalendarDate(new Date('2026-09-25T15:59:59Z'))).toBe('2026-09-25');
 });
 it('web reads support disabled-reminder filtering and never select ownership fields',async()=>{
  const calls:any[]=[];const q:any={};for(const method of ['select','is','order','limit'])q[method]=(...args:any[])=>{calls.push([method,...args]);return q;};q.then=(resolve:any)=>Promise.resolve({data:[],error:null}).then(resolve);
  await listModuleRecords({from:()=>q} as any,'subscription',{filters:{reminder_days:null}});
  expect(calls).toContainEqual(['is','reminder_days',null]);
  const projection=calls.find(([method])=>method==='select')[1];expect(projection).not.toBe('*');expect(projection.split(',')).not.toContain('user_id');
 });
 it('non-OAuth shared finance edits retain a subscription expense historical USD rate',async()=>{
  const calls:any[]=[];const q:any={};for(const method of ['select','eq','update'])q[method]=(...args:any[])=>{calls.push([method,...args]);return q;};
  q.maybeSingle=async()=>({data:{id:'bill',amount:20,currency:'USD',exchange_rate:7.1,amount_cny:142},error:null});
  const db:any={from:()=>q};
  const service=createAgentDataService({db,userId:'u',permissions:{read:true,write:true,delete:false}});
  await service.update('finance','bill',{amount:21});
  expect(calls.find(([method])=>method==='update')[1]).toMatchObject({amount:21,exchange_rate:7.1,amount_cny:149.1});
 });
});
