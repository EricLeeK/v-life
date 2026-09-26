import { normalizeSubscription, normalizeSubscriptionPatch, normalizeSubscriptionPayment, subscriptionPaymentRpcArgs } from '../../supabase/functions/_shared/subscriptionOperations';
import { prepareDemoPayment } from '@/lib/subscriptionDemo';
import type { Subscription, SubscriptionPayment } from '@/lib/subscriptions';
import type { DemoDataStore } from '@/data/demoSeed';

type Row=Record<string, any>;
interface Operation {module:string;action:string;data:Row}
interface Context {db:any;demo?:{
  state:{subscriptions:Subscription[];subscription_payments:SubscriptionPayment[]};
  addRecord:(table:keyof DemoDataStore,row:Row)=>Row;
  updateRecord:(table:keyof DemoDataStore,id:string,updates:Row)=>void;
  deleteRecord:(table:keyof DemoDataStore,id:string)=>void;
}}
export interface SubscriptionChatResult {row:Row;createdId?:string;duplicate?:boolean}

/** Subscription-created USD expenses retain their recorded conversion on correction. */
export function preserveUsdExpenseRate(existing:Row,updates:Row):Row {
  if(existing.currency!=='USD')return updates;
  if(updates.currency!==undefined&&updates.currency!=='USD')throw new Error('请在记账页面同时确认币种和汇率');
  if(updates.amount===undefined)return updates;
  if(typeof updates.amount!=='number'||!Number.isFinite(updates.amount)||updates.amount<0)throw new Error('金额必须为非负数');
  const rate=Number(existing.exchange_rate);if(!Number.isFinite(rate)||rate<=0)throw new Error('账单缺少已确认汇率，请在记账页面补充');
  return {...updates,exchange_rate:rate,amount_cny:Number((updates.amount*rate).toFixed(2))};
}

/** Owns the web assistant's subscription paths so generic/fuzzy CRUD cannot alter payments. */
export async function executeSubscriptionChatOperation(operation: Operation, context: Context): Promise<SubscriptionChatResult> {
  const {module,action,data}=operation,{db,demo}=context;
  if(module==='subscription_payment') {
    if(action!=='create')throw new Error('付款历史仅允许读取和确认，不能修改或删除');
    const payment=normalizeSubscriptionPayment(data);
    if(demo) {
      const stored=demo.state.subscriptions.find(item=>item.id===payment.subscription_id);
      if(!stored)throw new Error('未找到订阅');
      const prepared=prepareDemoPayment(stored,demo.state.subscription_payments,payment);
      if(!prepared.duplicate) {
        demo.addRecord('subscription_payments',prepared.payment);
        if(prepared.expense)demo.addRecord('finance_records',prepared.expense);
        demo.updateRecord('subscriptions',stored.id,{next_date:payment.next_date,status:'active'});
        demo.state.subscription_payments=[...demo.state.subscription_payments,prepared.payment];
        demo.state.subscriptions=demo.state.subscriptions.map(item=>item.id===stored.id?{...item,next_date:payment.next_date,status:'active'}:item);
      }
      return {row:prepared.payment,duplicate:prepared.duplicate};
    }
    const {data:row,error}=await db.rpc('confirm_subscription_payment',subscriptionPaymentRpcArgs(payment));
    if(error)throw error;
    if(!row)throw new Error('确认付款没有返回结果');
    return {row};
  }
  if(module!=='subscription')throw new Error('未知订阅操作');
  if(action==='create') {
    const payload=normalizeSubscription(data);
    if(demo) {
      const row=demo.addRecord('subscriptions',{...payload,id:crypto.randomUUID()});
      demo.state.subscriptions=[...demo.state.subscriptions,row as Subscription];
      return {row,createdId:row.id};
    }
    const {data:{user}}=await db.auth.getUser();if(!user)throw new Error('未登录');
    const {data:row,error}=await db.from('subscriptions').insert({...payload,user_id:user.id}).select().single();
    if(error)throw error;
    return {row,createdId:row.id};
  }
  if(!['update','delete'].includes(action))throw new Error('不支持的订阅操作');
  const match=data.match??{};
  if(Object.keys(match).some(key=>!['id','name'].includes(key)))throw new Error('请用订阅 ID 或精确名称定位');
  if(!match.id&&!String(match.name??'').trim())throw new Error('缺少订阅 ID 或名称');
  let matches:Row[];
  if(demo)matches=demo.state.subscriptions.filter(item=>match.id?item.id===match.id:item.name===String(match.name).trim());
  else {
    let query=db.from('subscriptions').select('*');
    query=match.id?query.eq('id',match.id):query.eq('name',String(match.name).trim());
    const result=await query.limit(2);if(result.error)throw result.error;matches=result.data??[];
  }
  if(!matches?.length)throw new Error('未找到订阅');
  if(matches.length>1)throw new Error('存在同名订阅，请指定 ID');
  const stored=matches[0];
  if(action==='delete') {
    if(demo) {
      for(const payment of demo.state.subscription_payments.filter(item=>item.subscription_id===stored.id))demo.deleteRecord('subscription_payments',payment.id);
      demo.deleteRecord('subscriptions',stored.id);
      demo.state.subscriptions=demo.state.subscriptions.filter(item=>item.id!==stored.id);
      demo.state.subscription_payments=demo.state.subscription_payments.filter(item=>item.subscription_id!==stored.id);
      return {row:stored};
    }
    const {error}=await db.from('subscriptions').delete().eq('id',stored.id);if(error)throw error;
    return {row:stored};
  }
  if(!data.update||!Object.keys(data.update).length)throw new Error('没有提供要修改的字段');
  normalizeSubscription(data.update,stored);
  const payload=normalizeSubscriptionPatch(data.update);
  if(demo) {
    demo.updateRecord('subscriptions',stored.id,payload);
    const row={...stored,...payload};
    demo.state.subscriptions=demo.state.subscriptions.map(item=>item.id===stored.id?row as Subscription:item);
    return {row};
  }
  const {data:row,error}=await db.from('subscriptions').update(payload).eq('id',stored.id).select().single();
  if(error)throw error;
  return {row};
}
