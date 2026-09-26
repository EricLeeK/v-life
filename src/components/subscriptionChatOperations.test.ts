import { describe, expect, it, vi } from 'vitest';
import * as executor from './subscriptionChatOperations';
import { normalizeSubscription } from '../../supabase/functions/_shared/subscriptionOperations';

const id='11111111-1111-4111-8111-111111111111';
const row={id,name:'Cloud',amount:20,currency:'USD',next_date:'2026-10-31'};
function database(records:any[]=[row]) {
 const calls:unknown[][]=[];const q:any={};
 for(const method of ['select','eq','limit','insert','update','delete'])q[method]=(...args:unknown[])=>{calls.push([method,...args]);return q;};
 q.then=(resolve:any)=>Promise.resolve({data:records,error:null}).then(resolve);
 q.single=async()=>({data:row,error:null});
 const db:any={from:vi.fn(()=>q),auth:{getUser:async()=>({data:{user:{id:'user'}}})},rpc:vi.fn(async()=>({data:{id:'payment',period_date:'2026-10-31'},error:null}))};
 return {db,calls};
}
describe('web subscription operation execution',()=>{
 it('saves validated subscription data with the authenticated owner',async()=>{
  const {db,calls}=database();await executor.executeSubscriptionChatOperation({module:'subscription',action:'create',data:{name:'Cloud',amount:20,currency:'USD',next_date:'2026-10-31'}},{db});
  expect(calls.find(call=>call[0]==='insert')?.[1]).toMatchObject({name:'Cloud',amount:20,currency:'USD',anchor_day:31,user_id:'user'});
 });
 it('uses exact name matching and rejects ambiguity instead of editing the first row',async()=>{
  const {db,calls}=database([row,{...row,id:'another'}]);
  await expect(executor.executeSubscriptionChatOperation({module:'subscription',action:'update',data:{match:{name:'Cloud'},update:{auto_renew:false}}},{db})).rejects.toThrow('同名');
  expect(calls).toContainEqual(['eq','name','Cloud']);expect(calls.some(c=>c[0]==='update')).toBe(false);
 });
 it('validates merged edits before writing and preserves stored anchor day',async()=>{
  const {db,calls}=database([{...row,anchor_day:31}]);
  await executor.executeSubscriptionChatOperation({module:'subscription',action:'update',data:{match:{id},update:{next_date:'2026-11-30',reminder_days:null}}},{db});
  expect(calls.find(call=>call[0]==='update')?.[1]).toEqual({next_date:'2026-11-30',reminder_days:null});
  expect(calls.find(call=>call[0]==='update')?.[1]).not.toHaveProperty('user_id');
 });
 it('does not overwrite a concurrently advanced renewal date when editing only notes',async()=>{
  const {db,calls}=database([{...row,status:'trial',anchor_day:31}]);
  await executor.executeSubscriptionChatOperation({module:'subscription',action:'update',data:{match:{id},update:{notes:'new note'}}},{db});
  const sent=calls.find(call=>call[0]==='update')?.[1];
  expect(sent).toEqual({notes:'new note'});
 });
 it('confirms real payments only with the atomic RPC and does not insert finance separately',async()=>{
  const {db,calls}=database();
  await executor.executeSubscriptionChatOperation({module:'subscription_payment',action:'create',data:{subscription_id:id,due_date:'2026-10-31',paid_on:'2026-09-25',amount:20,next_date:'2026-11-30',record_expense:true,exchange_rate:7}},{db});
  expect(db.rpc).toHaveBeenCalledWith('confirm_subscription_payment',expect.objectContaining({p_subscription_id:id,p_record_expense:true,p_exchange_rate:7}));
  expect(calls.some(c=>c[0]==='insert')).toBe(false);
 });
 it('executes demo CRUD without touching the live database',async()=>{
  const {db}=database();const state:any={subscriptions:[],subscription_payments:[]};
  const demo={state,addRecord:vi.fn((_table:string,record:any)=>record),updateRecord:vi.fn(),deleteRecord:vi.fn()};
  const {id:ignored,...input}=row;
  const saved=await executor.executeSubscriptionChatOperation({module:'subscription',action:'create',data:input},{db,demo});
  expect(state.subscriptions).toHaveLength(1);expect(saved.row.id).toBeTruthy();
  await executor.executeSubscriptionChatOperation({module:'subscription',action:'update',data:{match:{id:saved.row.id},update:{auto_renew:false}}},{db,demo});
  expect(state.subscriptions[0].auto_renew).toBe(false);
  await executor.executeSubscriptionChatOperation({module:'subscription',action:'delete',data:{match:{id:saved.row.id}}},{db,demo});
  expect(state.subscriptions).toHaveLength(0);expect(db.from).not.toHaveBeenCalled();expect(db.rpc).not.toHaveBeenCalled();
 });
 it('updates the demo snapshot synchronously so a repeated payment cannot double-log a bill',async()=>{
  const {db}=database();const {id:ignored,...input}=row;const state:any={subscriptions:[{id,...normalizeSubscription({...input,next_date:'2026-09-25'})}],subscription_payments:[]};
  const demo={state,addRecord:vi.fn((_table:string,record:any)=>record),updateRecord:vi.fn(),deleteRecord:vi.fn()};
  const operation={module:'subscription_payment',action:'create',data:{subscription_id:id,due_date:'2026-09-25',paid_on:'2026-09-25',amount:20,next_date:'2026-10-25',record_expense:true,exchange_rate:7}};
  await executor.executeSubscriptionChatOperation(operation,{db,demo});
  const retry=await executor.executeSubscriptionChatOperation(operation,{db,demo});
  expect(retry.duplicate).toBe(true);expect(state.subscription_payments).toHaveLength(1);expect(state.subscriptions[0].next_date).toBe('2026-10-25');
  expect(demo.addRecord.mock.calls.filter(call=>call[0]==='finance_records')).toHaveLength(1);expect(db.rpc).not.toHaveBeenCalled();
 });
 it('preserves the confirmed historical USD rate when web AI corrects a subscription expense amount',()=>{
  expect(executor.preserveUsdExpenseRate({currency:'USD',exchange_rate:7},{amount:21})).toEqual({amount:21,exchange_rate:7,amount_cny:147});
  expect(executor.preserveUsdExpenseRate({currency:'USD',exchange_rate:7},{notes:'corrected'})).toEqual({notes:'corrected'});
  expect(()=>executor.preserveUsdExpenseRate({currency:'USD',exchange_rate:null},{amount:21})).toThrow();
  expect(()=>executor.preserveUsdExpenseRate({currency:'USD',exchange_rate:7},{amount:-1})).toThrow();
 });
});
