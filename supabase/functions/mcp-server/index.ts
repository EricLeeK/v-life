import { CLASSIFICATION_MODULES, CLASSIFICATION_WORKFLOW } from '../_shared/agentClassifications.ts';
import { McpServer, StreamableHttpTransport } from 'mcp-lite';
import { withAgentAuth } from '../_shared/agentAuth.ts';
import { MODULES, agentMetaOf } from '../_shared/moduleRegistry.ts';
import { createAgentDataService, AgentDataError, type AgentContext } from '../_shared/agentDataService.ts';
import { AGENT_INSTRUCTIONS, GUIDE_TOPICS, buildAgentGuide, errorRecovery, moduleCanSearch, toolDescription } from '../_shared/agentGuide.ts';
import { fieldsSchema, buildCapabilities, MCP_VERSION, financeSummaryPeriod } from './mcpAdapter.ts';
import { objectSchema as object, listSchema, paginationSchema, recordIdSchema, idempotencySchema, validateToolInput, type Schema } from './toolSchema.ts';
import { TASK_OVERVIEW_DESCRIPTION, TASK_OVERVIEW_SCHEMA, TASK_TRANSFER_DESCRIPTION, TASK_TRANSFER_SCHEMA } from '../_shared/taskWorkflows.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { NEWSPAPER_OPERATIONS } from '../_shared/newspaperAgent.ts';
import { executeNewspaperOperation } from '../_shared/newspaperOperations.ts';
import { NewspaperError } from '../_shared/newspaperTypes.ts';
const url=Deno.env.get('SUPABASE_URL')!;
const resource=`${url}/functions/v1/mcp-server/mcp`;
const json=(v:any,isError=false)=>({content:[{type:'text' as const,text:JSON.stringify(v)}],structuredContent:v,isError});

export function serverFor(ctx:AgentContext,headerKey:string|null){
 const server=new McpServer({name:'vlife-manager',version:MCP_VERSION});
 server.use(async (request,next)=>{
  await next();
  if(request.request.method==='initialize'&&request.response&&'result' in request.response){
   (request.response.result as Record<string,unknown>).instructions=AGENT_INSTRUCTIONS;
  }
 });
 // Audit is already transactional for writes. Supplemental transport logging must
 // never report a successful mutation as failed or expose raw exception stacks.
 async function audit(name:string,op:string,id:unknown,success:boolean,errorCode:string|null){
  if(success&&['subscription_payment_create','daily_task_transfer'].includes(name))return; // transactional audit already committed
  try{
   const result=await ctx.db.rpc('agent_log_operation',{p_tool_name:name,p_operation:op,p_record_id:typeof id==='string'?id:null,p_request_id:ctx.requestId,p_success:success,p_error_code:errorCode});
   if(result.error)console.error('agent audit unavailable',ctx.requestId,result.error.code);
  }catch{console.error('agent audit unavailable',ctx.requestId);}
 }
 function register(name:string,description:string,inputSchema:Schema,op:'read'|'create'|'update'|'delete',fn:(s:ReturnType<typeof createAgentDataService>,p:any,callCtx:AgentContext)=>Promise<any>,annotations:Record<string,boolean>={}){
  server.tool(name,{description,inputSchema,annotations:{readOnlyHint:op==='read',destructiveHint:op==='delete',idempotentHint:op==='read',openWorldHint:false,...annotations},handler:async(input:unknown={})=>{
   let args:Record<string,any>={};
   try{
    validateToolInput(inputSchema,input);
    const {idempotency_key,...rest}=input;args=rest;
    if(headerKey!==null&&(headerKey.length<1||headerKey.length>200))throw new AgentDataError('INVALID_INPUT','Idempotency-Key must contain 1 to 200 characters');
    const callCtx={...ctx,toolName:name,idempotencyKey:idempotency_key??headerKey??undefined};
    const service=createAgentDataService(callCtx);
    const result=await fn(service,args,callCtx);
    await audit(name,op,result.data?.id,true,null);
    return json({ok:true,...result,request_id:ctx.requestId});
   }catch(error){
    const e=error instanceof AgentDataError||error instanceof NewspaperError?error:new AgentDataError('INTERNAL_ERROR','The operation could not be completed; preserve request_id');
    await audit(name,op,args.id,false,e.code);
    return json({ok:false,error:{code:e.code,message:e.message,...errorRecovery(e.code)},request_id:ctx.requestId},true);
   }
  }});
 }
 register('classification_list',CLASSIFICATION_WORKFLOW+' 返回当前用户的去重分类/标签及使用次数、预设值、allow_new、分页信息。包含已配置但尚未使用的想法标签；不返回记录正文或设置。',object({module:{type:'string',enum:CLASSIFICATION_MODULES,description:'目标模块；daily_task 读取 todo 分类。'},...paginationSchema()},['module']),'read',(s,{module,...opts})=>s.classifications(module,opts));
 register('agent_help','首次接入先调用：返回当前授权、服务器业务日期及入门指引。topic 可选 quickstart/tasks/finance/modules/classifications/errors；不写业务数据。资源客户端也可读 vlife://guide。',object({topic:{type:'string',enum:[...GUIDE_TOPICS],default:'quickstart',description:'quickstart 入门；tasks 待办工作流与示例；finance 账单汇总；modules 全部模块选用；classifications 自动分类规则；errors 错误恢复。'}}),'read',async(s,{topic})=>{
  const canReadDate=ctx.permissions.read||ctx.permissions.write;
  return {data:{session:{permissions:ctx.permissions,server_time:new Date().toISOString(),business_date:canReadDate?await s.businessDate():null,timezone:'Asia/Shanghai',business_day_rule:'当地时间减去用户 day_start_hour；daily_task_today 自动使用此日期。'},...buildAgentGuide(topic)}};
 });
 register('daily_task_today','分页读取当前用户业务日的任务，不必猜测日期。返回 date、data、hasMore、nextOffset；data.id 是日任务 ID，todo_id 是总待办 ID；标题可通过 todo_get 获取。可按 todo_id 或 is_completed 精确筛选。例行与一次性在此；习惯通过 todo_list(kind="habit") 和 habit_log_list 查看。',object({...paginationSchema(),todo_id:{...recordIdSchema('todo'),description:'可选：只读指定总待办在今天的任务。'},is_completed:{type:'boolean',description:'可选：true 已完成，false 未完成；省略包含两者。'}}),'read',async(s,{limit,offset,...filters})=>{
  const date=await s.businessDate();return {...await s.list('daily_task',{limit,offset,filters:{...filters,task_date:date}}),date};
 });
 register('daily_task_overview',TASK_OVERVIEW_DESCRIPTION,TASK_OVERVIEW_SCHEMA,'read',(s,args)=>s.taskOverview(args));
 register('daily_task_transfer',TASK_TRANSFER_DESCRIPTION,TASK_TRANSFER_SCHEMA,'update',(s,args)=>s.transferDailyTasks(args),{destructiveHint:true,idempotentHint:true});
 for(const [action,definition] of Object.entries(NEWSPAPER_OPERATIONS)){
  const read=definition.permission==='read';
  const schema={...definition.schema,properties:{...definition.schema.properties,...(!read?{idempotency_key:idempotencySchema}:{})}};
  register(`newspaper_${action}`,definition.description,schema,read?'read':definition.permission==='delete'?'delete':'update',async(_service,input,callCtx)=>{
   const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
   return {data:await executeNewspaperOperation({...callCtx,admin},action,input)};
  },{openWorldHint:definition.paid===true,idempotentHint:read||definition.paid===true});
 }
 for(const mod of MODULES.filter(m=>agentMetaOf(m).agentVisible)){
  const key=mod.key;
  register(`${key}_list`,toolDescription(mod,'list'),listSchema(mod),'read',(s,{limit,offset,date_from,date_to,...filters})=>s.list(key,{limit,offset,date_from,date_to,filters}));
  if(moduleCanSearch(mod))register(`${key}_search`,toolDescription(mod,'search'),object({...paginationSchema(mod),keyword:{type:'string',minLength:1,description:`按 ${mod.executor!.nameField} 文字包含搜索，不区分大小写；不是语义搜索。`}},['keyword']),'read',(s,{keyword,...opts})=>s.search(key,keyword,opts));
  register(`${key}_get`,toolDescription(mod,'get'),object({id:recordIdSchema(key)},['id']),'read',(s,p)=>s.get(key,p.id));
  for(const op of ['create','update','delete'] as const){
   if(!mod.actions[op])continue;
   const schema=op==='delete'?object({id:recordIdSchema(key),idempotency_key:idempotencySchema},['id']):fieldsSchema(mod,op);
   register(`${key}_${op}`,toolDescription(mod,op),schema,op,(s,{id,...payload})=>op==='create'?s.create(key,payload):op==='update'?s.update(key,id,payload):s.delete(key,id));
  }
 }
 register('data_export','按模块分页导出白名单数据，不包含设置和密钥。modules 省略时导出所有可导出模块的一页；每个模块独立返回 hasMore/nextOffset，请逐模块继续分页。',object({...paginationSchema(),date_from:{type:'string',format:'date',description:'起始日，含当天；仅应用于有日期字段的模块。'},date_to:{type:'string',format:'date',description:'截止日，含当天；仅应用于有日期字段的模块。'},modules:{type:'array',items:{type:'string',enum:MODULES.filter(m=>agentMetaOf(m).agentVisible&&agentMetaOf(m).exportable).map(m=>m.key)},description:'模块 key 数组；省略表示全部可导出模块。'}}),'read',async(s,{modules,...opts})=>{
  const keys=modules??MODULES.filter(m=>agentMetaOf(m).agentVisible&&agentMetaOf(m).exportable).map(m=>m.key);const data:Record<string,unknown>={};for(const k of keys){const {date_from,date_to,...page}=opts;data[k]=await s.export(k,{limit:50,...(MODULES.find(m=>m.key===k)?.executor?.dateField?opts:page)});}return{data};
 });
 register('finance_summary','完整财务汇总：无参数为北京时间当月；可传 year/month 成对参数，或 date_from/date_to 范围（含首尾、可仅一端），两者不可混用。遍历所有分页，金额取已保存的 amount_cny；空月份返回 count=0,total_cny=0,by_category={}。',object({year:{type:'integer',minimum:1900,maximum:9999,description:'年份；指定时必须同时传 month。'},month:{type:'integer',minimum:1,maximum:12,description:'月份1..12；指定时必须同时传 year。'},date_from:{type:'string',format:'date',description:'范围起始日，含当日；不可与年月混用。'},date_to:{type:'string',format:'date',description:'范围结束日，含当日；不可与年月混用。'}}),'read',(s,p)=>s.financeSummary(financeSummaryPeriod(p)));
 register('subscription_summary','完整订阅汇总，遍历所有页。月均预算、按量预估、未来30天预计扣费按币种独立返回；月均不等于实际支出，逾期待确认不会自动视为付款。as_of_date 默认北京时间今日。',object({as_of_date:{type:'string',format:'date',description:'汇总基准日，默认北京时间今日'}}),'read',(s,p)=>s.subscriptionSummary(p.as_of_date));
 server.resource('vlife://capabilities',{name:'vlife_capabilities',description:'全部模块、可用操作、字段、版本；首次接入请先调用 agent_help。',mimeType:'application/json'},async()=>({contents:[{type:'text',uri:'vlife://capabilities',mimeType:'application/json',text:JSON.stringify(buildCapabilities())}]}));
 server.resource('vlife://guide',{name:'vlife_agent_guide',description:'V-Life Agent 使用指南：工作流、ID区分、示例、分页、权限与错误恢复。当前授权与业务日期请调用 agent_help。',mimeType:'application/json'},async()=>({contents:[{type:'text',uri:'vlife://guide',mimeType:'application/json',text:JSON.stringify(Object.fromEntries(GUIDE_TOPICS.map(topic=>[topic,buildAgentGuide(topic)])))}]}));
 return server;
}
const protectedHandler=withAgentAuth(resource,async(req,ctx)=>{
 const server=serverFor(ctx,req.headers.get('Idempotency-Key'));
 const transport=new StreamableHttpTransport();return transport.bind(server)(req);
});
export async function handleRequest(req:Request){
 const origin=req.headers.get('origin');
 const allowed=(Deno.env.get('MCP_ALLOWED_ORIGINS')??'https://shenghuo.homes,http://localhost:6274,http://localhost:5173').split(',');
 if(origin&&!allowed.includes(origin))return Response.json({error:'ORIGIN_NOT_ALLOWED'},{status:403});
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':origin??'*','Access-Control-Allow-Headers':'Authorization,Content-Type,Accept,MCP-Protocol-Version,Idempotency-Key','Access-Control-Allow-Methods':'GET,POST,DELETE,OPTIONS'}});
 const path=new URL(req.url).pathname;
 if(!path.endsWith('/mcp')&&!path.endsWith('/oauth-protected-resource')&&!path.endsWith('/mcp-server'))return Response.json({error:'NOT_FOUND'},{status:404});
 const response=await protectedHandler(req);const headers=new Headers(response.headers);
 if(origin)headers.set('Access-Control-Allow-Origin',origin);
 headers.set('Access-Control-Expose-Headers','WWW-Authenticate,MCP-Session-Id');headers.set('Cache-Control','no-store');
 return new Response(response.body,{status:response.status,headers});
}
if(import.meta.main)Deno.serve(handleRequest);
