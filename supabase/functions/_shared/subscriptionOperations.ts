import { normalizeSubscriptionUrl } from './subscriptionDomain.ts';

export interface SubscriptionPaymentInput {
  subscription_id: string;
  due_date: string;
  paid_on: string;
  amount: number;
  next_date: string;
  record_expense: boolean;
  exchange_rate?: number | null;
}
export const subscriptionWriteFields = ['name','url','management_url','category','plan','account','notes','amount','currency','billing_type','billing_unit','billing_interval','status','auto_renew','next_date','anchor_day','reminder_days'] as const;
export function subscriptionCalendarDate(now = new Date()):string {return new Date(now.getTime()+8*3600000).toISOString().slice(0,10);}
const date = (value: unknown): value is string => typeof value==='string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10)===value;
const invalid = (message: string): never => { throw Object.assign(new Error(message), {code:'INVALID_INPUT'}); };
const numeric = (value:unknown,min:number,integer=false,max=Infinity) => typeof value==='number' && Number.isFinite(value) && value>=min && value<=max && (!integer || Number.isInteger(value));

/** Validate just a patch without changing fields the caller did not supply. */
export function normalizeSubscriptionPatch(input: Record<string,unknown>): Record<string,unknown> {
  const result: Record<string,unknown> = {};
  for(const [key,value] of Object.entries(input)) {
    if(!(subscriptionWriteFields as readonly string[]).includes(key))invalid(`不允许写入字段 ${key}`);
    if(value===undefined)continue;
    if(value===null&&['url','management_url','plan','account','notes'].includes(key)){result[key]=null;continue;}
    if(['name','category','plan','account','notes'].includes(key)) {
      if(typeof value!=='string')invalid(`${key} 必须为文字`);
      if(['name','category'].includes(key)&&!String(value).trim())invalid(`${key} 不能为空`);
      result[key]=['name','category'].includes(key)?String(value).trim():value;continue;
    }
    if(key==='url'||key==='management_url') {
      if(typeof value!=='string')invalid(`${key} 必须为网址文字`);
      try {result[key]=normalizeSubscriptionUrl(value as string);}catch {invalid(`${key} 只允许有效 http/https 网址`);}continue;
    }
    if(key==='amount'&&!numeric(value,0,false,1e12))invalid('金额必须是0到1万亿的数值');
    if(key==='billing_interval'&&!numeric(value,1,true,input.billing_unit==='month'?120:3660))invalid('账期间隔必须是有效的正整数（月最多120，日最多3660）');
    if(key==='anchor_day'&&!numeric(value,1,true,31))invalid('锚定日必须为1到31的整数');
    if(key==='reminder_days'&&value!==null&&!numeric(value,0,true,365))invalid('提醒天数必须是0到365的整数或 null');
    if(key==='next_date'&&!date(value))invalid('下次日期必须是有效的 YYYY-MM-DD');
    if(key==='auto_renew'&&typeof value!=='boolean')invalid('自动续订必须为布尔值');
    const enums:Record<string,string[]>={currency:['CNY','USD','JPY'],billing_type:['fixed','usage'],billing_unit:['month','day'],status:['active','trial','ended']};
    if(enums[key]&&!enums[key].includes(String(value)))invalid(`无效的 ${key}`);
    result[key]=value;
  }
  return result;
}

/** Defaults only apply to creation/full form saves; IDs and ownership never enter the result. */
export function normalizeSubscription(input: Record<string,unknown>, existing?: Record<string,unknown>): Record<string,unknown> {
  const base=existing?Object.fromEntries(subscriptionWriteFields.filter(key=>existing[key]!==undefined).map(key=>[key,existing[key]])):{};
  const patch=normalizeSubscriptionPatch(input);
  const row=normalizeSubscriptionPatch({category:'其他',billing_type:'fixed',billing_unit:'month',billing_interval:1,status:'active',auto_renew:true,reminder_days:3,url:'',management_url:'',plan:'',account:'',notes:'',...base,...patch});
  for(const key of ['name','amount','currency','next_date'])if(row[key]===undefined||row[key]==='')invalid(`缺少 ${key}；金额和日期必须由用户确认`);
  row.anchor_day??=Number(String(row.next_date).slice(-2));
  return row;
}

export function normalizeSubscriptionPayment(input: Record<string,unknown>): SubscriptionPaymentInput {
  const allowed=['subscription_id','due_date','paid_on','amount','next_date','record_expense','exchange_rate'];
  for(const key of Object.keys(input))if(!allowed.includes(key))invalid(`不允许写入付款字段 ${key}`);
  if(typeof input.subscription_id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.subscription_id))invalid('请使用真实订阅 UUID');
  for(const key of ['due_date','paid_on','next_date'])if(!date(input[key]))invalid(`${key} 必须是有效日期`);
  if(String(input.next_date)<=String(input.due_date))invalid('下次日期必须晚于本账期日期');
  if(!numeric(input.amount,0,false,1e12))invalid('实际付款金额必须是0到1万亿的数值');
  if(input.record_expense!==undefined&&typeof input.record_expense!=='boolean')invalid('record_expense 必须为布尔值');
  if(input.exchange_rate!==undefined&&input.exchange_rate!==null&&(!numeric(input.exchange_rate,0)||input.exchange_rate===0))invalid('汇率必须是正数');
  return {...input,record_expense:input.record_expense??false} as unknown as SubscriptionPaymentInput;
}

export function subscriptionPaymentRpcArgs(input: SubscriptionPaymentInput) {
  return {p_subscription_id:input.subscription_id,p_due_date:input.due_date,p_paid_on:input.paid_on,p_amount:input.amount,p_next_date:input.next_date,p_record_expense:input.record_expense,p_exchange_rate:input.exchange_rate??null};
}
