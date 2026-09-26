import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { StreamableHttpTransport } from 'mcp-lite';
import { serverFor } from './index.ts';
const id='11111111-1111-4111-8111-111111111111';
const payment={subscription_id:id,due_date:'2026-09-25',paid_on:'2026-09-25',amount:20,next_date:'2026-10-25'};
function fixture(write=true) {
 const calls:any[]=[];const q:any={};for(const m of ['select','eq','order','range'])q[m]=()=>q;
 q.then=(resolve:any)=>Promise.resolve({data:[],error:null}).then(resolve);
 const db:any={from:()=>q,rpc:async(name:string,args:any)=>{calls.push([name,args]);return {data:name==='confirm_subscription_payment'?{id:'payment',...payment,period_date:payment.due_date,currency:'USD',user_id:'hidden'}:null,error:null};}};
 const handle=new StreamableHttpTransport().bind(serverFor({db,userId:'u',clientId:'c',requestId:'r',permissions:{read:true,write,delete:false}},null));
 async function rpc(method:string,params:any={}) {
  const response=await handle(new Request('http://localhost/mcp',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})}));
  const raw=await response.text();return JSON.parse(raw.startsWith('data: ')?raw.slice(6).trim():raw).result;
 }
 return {calls,rpc,call:(name:string,args:any={})=>rpc('tools/call',{name,arguments:args})};
}
Deno.test('MCP confirms subscription payment and protects the dedicated RPC with write permission',async()=>{
 const {call,calls}=fixture();const result=(await call('subscription_payment_create',payment)).structuredContent;
 assertEquals(result.ok,true);assertEquals(result.data.period_date,payment.due_date);assert(!('user_id' in result.data));
 assert(calls.some(([name,args])=>name==='confirm_subscription_payment'&&args.p_record_expense===false));
 const denied=fixture(false);const response=(await denied.call('subscription_payment_create',{...payment,record_expense:true,exchange_rate:7})).structuredContent;
 assertEquals(response.error.code,'PERMISSION_DENIED');assert(!denied.calls.some(([name])=>name==='confirm_subscription_payment'));
});
Deno.test('MCP discovers subscription history, nullable reminders and a complete summary tool',async()=>{
 const {rpc,call}=fixture();const {tools}=await rpc('tools/list');
 const create=tools.find((tool:any)=>tool.name==='subscription_create');assertEquals(create.inputSchema.properties.reminder_days.type,['integer','null']);
 assert(tools.find((tool:any)=>tool.name==='subscription_payment_list'));assert(!tools.find((tool:any)=>tool.name==='subscription_payment_delete'));
 const summary=(await call('subscription_summary',{as_of_date:'2026-09-25'})).structuredContent;
 assertEquals(summary.ok,true);assertEquals(summary.data.monthly,{});assertEquals(summary.data.as_of_date,'2026-09-25');
});
