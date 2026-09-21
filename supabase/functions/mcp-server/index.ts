import { McpServer, StreamableHttpTransport } from 'mcp-lite';
import { withOAuthProtectedResource, withSupabase } from 'npm:@supabase/server@1.6.0';
import { MODULES, agentMetaOf } from '../_shared/moduleRegistry.ts';
import { createAgentDataService, AgentDataError, type AgentContext } from '../_shared/agentDataService.ts';
import { fieldsSchema,buildCapabilities,MCP_VERSION } from './mcpAdapter.ts';
const url=Deno.env.get('SUPABASE_URL')!;
const resource=`${url}/functions/v1/mcp-server/mcp`;
const json=(v:any,isError=false)=>({content:[{type:'text' as const,text:JSON.stringify(v)}],structuredContent:v,isError});
const object=(properties:Record<string,any>,required:string[]=[])=>({type:'object' as const,properties,required,additionalProperties:false});
const pageFields={limit:{type:'integer',minimum:1,maximum:200},offset:{type:'integer',minimum:0},date_from:{type:'string',format:'date'},date_to:{type:'string',format:'date'}};
function serverFor(ctx:AgentContext,headerKey:string|null){
 const server=new McpServer({name:'vlife-manager',version:MCP_VERSION});
 const run=(name:string,op:string,fn:(s:ReturnType<typeof createAgentDataService>,p:any)=>Promise<any>)=>async(p:any)=>{
   const {idempotency_key,...args}=p;const service=createAgentDataService({...ctx,toolName:name,idempotencyKey:idempotency_key??headerKey??undefined});
   try{
    const result=await fn(service,args);
    const log=await ctx.db.rpc('agent_log_operation',{p_tool_name:name,p_operation:op,p_record_id:result.data?.id??null,p_request_id:ctx.requestId,p_success:true,p_error_code:null});
    if(log.error) console.error('agent audit unavailable',ctx.requestId,log.error.code);
    return json({ok:true,...result,request_id:ctx.requestId});
   }catch(error){
    const e=error instanceof AgentDataError?error:new AgentDataError('INTERNAL_ERROR','The operation could not be completed');
    await ctx.db.rpc('agent_log_operation',{p_tool_name:name,p_operation:op,p_record_id:args.id??null,p_request_id:ctx.requestId,p_success:false,p_error_code:e.code});
    return json({ok:false,error:{code:e.code,message:e.message},request_id:ctx.requestId},true);
   }
 };
 for(const mod of MODULES.filter(m=>agentMetaOf(m).agentVisible)){
  const key=mod.key,meta=agentMetaOf(mod),props:Record<string,any>={...pageFields};
  for(const f of mod.fields.filter(f=>meta.readFields.includes(f.name)&&!f.internal))props[f.name]={type:['date','datetime'].includes(f.type)?'string':f.type,...(f.type==='array'?{items:{}}:{})};
  server.tool(`${key}_list`,{description:`分页读取${mod.labelZh}，使用 nextOffset 获取下一页`,inputSchema:object(props),handler:run(`${key}_list`,'read',(s,{limit,offset,date_from,date_to,...filters})=>s.list(key,{limit,offset,date_from,date_to,filters}))});
  if(mod.executor?.nameField&&meta.readFields.includes(mod.executor.nameField))server.tool(`${key}_search`,{description:`搜索${mod.labelZh}`,inputSchema:object({...pageFields,keyword:{type:'string'}},['keyword']),handler:run(`${key}_search`,'read',(s,{keyword,...opts})=>s.search(key,keyword,opts))});
  server.tool(`${key}_get`,{description:`读取单条${mod.labelZh}`,inputSchema:object({id:{type:'string',format:'uuid'}},['id']),handler:run(`${key}_get`,'read',(s,p)=>s.get(key,p.id))});
  for(const op of ['create','update','delete'] as const){
   if(!mod.actions[op])continue;
   const schema=op==='delete'?object({id:{type:'string',format:'uuid'},idempotency_key:{type:'string',minLength:1,maxLength:200}},['id']):fieldsSchema(mod,op);
   server.tool(`${key}_${op}`,{description:`${op==='create'?'新增':op==='update'?'修改':'删除'}${mod.labelZh}`,inputSchema:schema,handler:run(`${key}_${op}`,op,(s,{id,...payload})=>op==='create'?s.create(key,payload):op==='update'?s.update(key,id,payload):s.delete(key,id))});
  }
 }
 server.tool('data_export',{description:'分页导出白名单数据，按模块返回 nextOffset；不包含账号设置和密钥',inputSchema:object({...pageFields,modules:{type:'array',items:{type:'string'}}}),handler:run('data_export','read',async(s,{modules,...opts})=>{
  const keys=modules??MODULES.filter(m=>agentMetaOf(m).agentVisible&&agentMetaOf(m).exportable).map(m=>m.key);const data:Record<string,unknown>={};for(const k of keys)data[k]=await s.export(k,opts);return{data};
 })});
 server.tool('finance_summary',{description:'指定月份的完整财务汇总',inputSchema:object({year:{type:'integer',minimum:1900,maximum:9999},month:{type:'integer',minimum:1,maximum:12}},['year','month']),handler:run('finance_summary','read',(s,p)=>{
  const from=`${p.year}-${String(p.month).padStart(2,'0')}-01`;const end=new Date(Date.UTC(p.year,p.month,0)).toISOString().slice(0,10);return s.financeSummary({date_from:from,date_to:end});
 })});
 server.resource('vlife://capabilities',{name:'vlife_capabilities',description:'数据能力、字段与版本',mimeType:'application/json'},async()=>({contents:[{type:'text',uri:'vlife://capabilities',mimeType:'application/json',text:JSON.stringify(buildCapabilities())}]}));
 return server;
}
const authenticated=withSupabase({auth:'user'},async(req,auth)=>{
 const claims=auth.jwtClaims;
 if(!claims?.sub||typeof claims.client_id!=='string')return Response.json({error:'OAUTH_TOKEN_REQUIRED'},{status:403});
 const db=auth.supabase as any;
 const {data:grant,error}=await db.from('agent_client_access').select('read_enabled,write_enabled,delete_enabled,revoked_at').eq('user_id',claims.sub).eq('client_id',claims.client_id).maybeSingle();
 if(error||!grant||grant.revoked_at)return Response.json({error:'AGENT_ACCESS_DENIED'},{status:403});
 const ctx:AgentContext={db:db as any,userId:claims.sub,clientId:claims.client_id,requestId:crypto.randomUUID(),permissions:{read:grant.read_enabled===true,write:grant.write_enabled===true,delete:grant.delete_enabled===true}};
 const server=serverFor(ctx,req.headers.get('Idempotency-Key'));
 const transport=new StreamableHttpTransport();return transport.bind(server)(req);
});
const protectedHandler=withOAuthProtectedResource({resourceServer:resource,authorizationServer:`${url}/auth/v1`},authenticated);
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
