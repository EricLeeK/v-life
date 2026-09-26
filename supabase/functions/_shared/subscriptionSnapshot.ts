import { normalizeSubscription, subscriptionWriteFields } from './subscriptionOperations.ts';
import { agentMetaOf, moduleByKey } from './moduleRegistry.ts';
import type { Subscription } from './subscriptionDomain.ts';
import type { ReadOpts } from './dataReader.ts';
type Row=Record<string,unknown>;
export interface SubscriptionSnapshot {subscriptions:Subscription[];subscription_payments:Row[]}
/** Browser demo data stays separate from live reads and is always treated as data. */
export function parseSubscriptionSnapshot(input: unknown): SubscriptionSnapshot|null {
  if(input===undefined)return null;
  if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Invalid demo subscription snapshot');
  const source=input as Record<string,unknown>;
  for(const key of ['subscriptions','subscription_payments'])if(!Array.isArray(source[key])||(source[key] as unknown[]).length>1000)throw new Error('Invalid or excessive demo subscription snapshot');
  const subscriptions=(source.subscriptions as Row[]).map(row=>{
    if(!row||typeof row.id!=='string')throw new Error('Invalid demo subscription');
    const fields=Object.fromEntries(subscriptionWriteFields.filter(key=>row[key]!==undefined).map(key=>[key,row[key]]));
    return {id:row.id,...normalizeSubscription(fields)} as unknown as Subscription;
  });
  const fields=['id',...agentMetaOf(moduleByKey.subscription_payment).readFields];
  const payments=(source.subscription_payments as Row[]).map(row=>{
    if(!row||typeof row.id!=='string'||typeof row.subscription_id!=='string'||typeof row.amount!=='number'||!Number.isFinite(row.amount)||row.amount<0)throw new Error('Invalid demo payment');
    return Object.fromEntries(Object.entries(row).filter(([key])=>fields.includes(key)));
  });
  return {subscriptions,subscription_payments:payments};
}
export function readSubscriptionSnapshot(snapshot: SubscriptionSnapshot,module: string,opts: ReadOpts={}): Row[] {
  const mod=moduleByKey[module];if(!['subscription','subscription_payment'].includes(module))throw new Error('Invalid demo subscription module');
  const source=(module==='subscription'?snapshot.subscriptions:snapshot.subscription_payments) as unknown as Row[];
  const allowed=new Set(['id',...agentMetaOf(mod).readFields]);
  const dateField=mod.executor!.dateField!;
  const limit=Math.max(1,Math.min(opts.limit??50,200));
  return source.filter(row=>{
    if(opts.date_from&&String(row[dateField])<opts.date_from)return false;
    if(opts.date_to&&String(row[dateField])>opts.date_to)return false;
    return Object.entries(opts.filters??{}).every(([key,value])=>{
      const field=mod.fields.find(item=>item.name===key);
      if(allowed.has(key)&&value===null&&field?.nullable)return row[key]===null;
      if(!allowed.has(key)||value===null||value===undefined||value==='')return true;
      if(key==='id'||key.endsWith('_id')||field?.type!=='string'||field?.enum)return row[key]===value;
      return String(row[key]??'').toLowerCase().includes(String(value).toLowerCase());
    });
  }).sort((a,b)=>String(b[dateField]).localeCompare(String(a[dateField]))).slice(0,limit);
}
