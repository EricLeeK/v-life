import { describe, expect, it } from 'vitest';
import { parseSubscriptionSnapshot, readSubscriptionSnapshot } from './subscriptionSnapshot';
const input={subscriptions:[{id:'s',name:'Demo',amount:20,currency:'USD',next_date:'2026-10-31',user_id:'private'}],subscription_payments:[{id:'p',subscription_id:'s',period_date:'2026-09-30',paid_on:'2026-09-25',amount:20,currency:'USD',next_date:'2026-10-31',user_id:'private'}]};
describe('demo subscription read snapshot',()=>{
 it('normalizes subscription rows and removes ownership from model data',()=>{
  const snapshot=parseSubscriptionSnapshot(input)!;
  expect(snapshot.subscriptions[0]).toMatchObject({billing_unit:'month',anchor_day:31});
  expect(snapshot.subscriptions[0]).not.toHaveProperty('user_id');expect(snapshot.subscription_payments[0]).not.toHaveProperty('user_id');
 });
 it('filters payment history and upcoming records within supplied demo data only',()=>{
  const snapshot=parseSubscriptionSnapshot(input)!;
  expect(readSubscriptionSnapshot(snapshot,'subscription',{date_to:'2026-10-30'})).toEqual([]);
  expect(readSubscriptionSnapshot(snapshot,'subscription_payment',{filters:{subscription_id:'missing'}})).toEqual([]);
  expect(readSubscriptionSnapshot(snapshot,'subscription_payment',{filters:{subscription_id:'s'}})).toHaveLength(1);
  expect(readSubscriptionSnapshot(snapshot,'subscription',{filters:{reminder_days:null}})).toEqual([]);
 });
 it('rejects malformed or excessive snapshots without falling back to live data',()=>{
  expect(parseSubscriptionSnapshot(undefined)).toBeNull();
  expect(()=>parseSubscriptionSnapshot({...input,subscriptions:[{...input.subscriptions[0],amount:-1}]})).toThrow();
  expect(()=>parseSubscriptionSnapshot({...input,subscriptions:Array(1001).fill(input.subscriptions[0])})).toThrow();
 });
});
