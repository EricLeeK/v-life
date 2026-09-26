import {buildAgentGuide} from '../_shared/agentGuide.ts';
import {validateToolInput} from './toolSchema.ts';
import { assert, assertEquals } from 'https://deno.land/std@0.224.0/assert/mod.ts';
import { StreamableHttpTransport } from 'mcp-lite';
import { serverFor } from './index.ts';

const todoId='11111111-1111-4111-8111-111111111111';
function fixture(auditFails=false) {
 const calls: any[]=[];const filters:any[]=[];
 const q:any={};
 for(const m of ['select','eq','gte','lte','order','range','limit'])q[m]=(...args:any[])=>{filters.push([m,...args]);return q;};
 q.then=(resolve:any)=>Promise.resolve({data:[],error:null}).then(resolve);
 q.maybeSingle=async()=>({data:{id:todoId,title:'买牛奶',kind:'once'},error:null});
 const db:any={from:()=>q,rpc:async(name:string,args:any)=>{
  calls.push([name,args]);
  if(name==='agent_log_operation'&&auditFails)throw new Error('audit unavailable');
  if(name==='agent_classifications')return {data:{data:[{value:'工作',usage_count:3,configured:false}],total:1,hasMore:false,nextOffset:null},error:null};
  if(name==='task_business_date')return {data:'2026-09-24',error:null};
  if(name==='agent_mutate')return {data:{data:{id:todoId,title:'买牛奶',is_completed:true}},error:null};
  return {data:null,error:null};
 }};
 const handle=new StreamableHttpTransport().bind(serverFor({db,userId:'user',clientId:'client',requestId:'req',permissions:{read:true,write:true,delete:false}},null));
 async function rpc(method:string,params:any={}) {
  const res=await handle(new Request('http://localhost/mcp',{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})}));
  const raw=await res.text();const envelope=JSON.parse(raw.startsWith('data: ')?raw.slice(6).trim():raw);
  assert(envelope.result,JSON.stringify(envelope));return envelope.result;
 }
 return {rpc,calls,filters,call:(name:string,args:any={})=>rpc('tools/call',{name,arguments:args})};
}
Deno.test('first connection points to help and exposes readable onboarding resources',async()=>{
 const {rpc,call}=fixture();
 const init=await rpc('initialize',{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'new-agent',version:'1'}});
 assert(init.instructions?.includes('agent_help'));
 const help=(await call('agent_help')).structuredContent;
 assertEquals(help.ok,true);assertEquals(help.data.session.permissions.delete,false);
 assertEquals(help.data.session.business_date,'2026-09-24');
 const resources=await rpc('resources/list');
 assert(resources.resources.some((r:any)=>r.uri==='vlife://guide'));
 const guide=await rpc('resources/read',{uri:'vlife://guide'});
 assert(guide.contents[0].text.includes('todo_id'));
});
Deno.test('tool discovery explains IDs, full date scope, and completion side effects',async()=>{
 const {rpc}=fixture();const {tools}=await rpc('tools/list');
 const get=(name:string)=>tools.find((t:any)=>t.name===name);
 assert(get('todo_update').description.includes('同步'));
 assert(get('daily_task_list').description.includes('所有日期'));
 assert(get('daily_task_update').inputSchema.properties.id.description.includes('daily_task'));
 assert('date_from' in get('todo_list').inputSchema.properties);
 assert(get('todo_list').inputSchema.properties.date_from.description.includes('completed_at'));
 assertEquals(get('todo_list').annotations.readOnlyHint,true);
 assertEquals(get('todo_delete').annotations.destructiveHint,true);
 assert(!get('habit_log_create').inputSchema.required.includes('title'));
});
Deno.test('invalid inputs get actionable errors without database calls',async()=>{
 for(const [name,args] of [['todo_update',{id:'wrong',is_completed:true}],['todo_create',{title:'x',typo:1}],['daily_task_create',{}],['todo_list',{date_from:'2026-02-30'}],['todo_create',null]]) {
  const {call,calls}=fixture();const result=await call(name as string,args);
  assertEquals(result.structuredContent.ok,false);
  assertEquals(result.structuredContent.error.code,'INVALID_INPUT');
  assert(result.structuredContent.error.recovery);
  assert(!calls.some(c=>c[0]==='agent_mutate'));
 }
});
Deno.test('audit outage cannot turn a completed write into a false failure',async()=>{
 const {call,calls}=fixture(true);
 const result=await call('todo_update',{id:todoId,is_completed:true,idempotency_key:'op-1'});
 assertEquals(result.structuredContent.ok,true);
 assertEquals(calls.filter(c=>c[0]==='agent_mutate').length,1);
});
Deno.test('today helper applies the server business date rather than guessing',async()=>{
 const {call,filters}=fixture();const r=await call('daily_task_today');
 assertEquals(r.structuredContent.ok,true);
 assertEquals(r.structuredContent.date,'2026-09-24');
 assert(filters.some(c=>c[0]==='eq'&&c[1]==='task_date'&&c[2]==='2026-09-24'));
});
Deno.test('create schemas declare mandatory database dates and course relation',async()=>{
 const {tools}=await fixture().rpc('tools/list');
 for(const [module,field] of [['weight','date'],['measurement','date'],['civil_plan','plan_date'],['civil_checkin','date'],['civil_xingce_paper','taken_date'],['learning_note','course_name']]) {
  assert(tools.find((t:any)=>t.name===`${module}_create`).inputSchema.required.includes(field),`${module}.${field}`);
 }
});

Deno.test('published workflow examples match discovered input schemas',async()=>{
 const {tools}=await fixture().rpc('tools/list');
 const guide:any=buildAgentGuide('tasks'); const finance:any=buildAgentGuide('finance');
 const examples=[...guide.examples.flatMap((e:any)=>e.steps),...finance.examples];
 for(const e of examples){
  const input=JSON.parse(JSON.stringify(e.arguments).replace(/\$[a-z]+\.id/g,todoId).replace(/\$new_key/g,'unique-operation-key'));
  const tool=tools.find((t:any)=>t.name===e.tool);assert(tool, e.tool);
  validateToolInput(tool.inputSchema,input);
 }
});
Deno.test('multi-module export applies dates only to dated modules',async()=>{
 const {call}=fixture();const r=await call('data_export',{modules:['todo','finance'],date_from:'2026-09-01'});
 assertEquals(r.structuredContent.ok,true);
 assert(r.structuredContent.data.todo);assert(r.structuredContent.data.finance);
});
Deno.test('classification discovery is part of first-contact and create descriptions',async()=>{
 const {rpc}=fixture();const {tools}=await rpc('tools/list');
 const discovery=tools.find((t:any)=>t.name==='classification_list');assert(discovery);
 assertEquals(discovery.annotations.readOnlyHint,true);
 assert(tools.find((t:any)=>t.name==='todo_create').description.includes('classification_list'));
 assert(tools.find((t:any)=>t.name==='daily_task_create').description.includes('classification_list'));
 const init=await rpc('initialize',{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'test',version:'1'}});
 assert(init.instructions.includes('classification_list'));
});

Deno.test('MCP classification result can be reused in a create call',async()=>{
 const {call,calls}=fixture();
 const r=(await call('classification_list',{module:'todo'})).structuredContent;
 assertEquals(r.ok,true);assertEquals(r.allow_new,true);assertEquals(r.data[0].value,'工作');
 const created=await call('todo_create',{title:'处理邮件',category:r.data[0].value,idempotency_key:'classify-task'});
 assertEquals(created.structuredContent.ok,true);
 assertEquals(calls.find(c=>c[0]==='agent_mutate')[1].p_payload.category,'工作');
});
