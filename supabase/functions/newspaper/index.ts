import { createClient } from 'npm:@supabase/supabase-js@2';
import { NewspaperError, type NewspaperContext } from '../_shared/newspaperTypes.ts';
import { NEWSPAPER_OPERATIONS } from '../_shared/newspaperAgent.ts';
import { executeNewspaperOperation } from '../_shared/newspaperOperations.ts';
import { createNewspaperService } from '../_shared/newspaperService.ts';
import { createNewspaperImageService } from '../_shared/newspaperImageService.ts';
const allowedOrigins=(Deno.env.get('NEWSPAPER_ALLOWED_ORIGINS')??'https://shenghuo.homes,http://localhost:5173,http://localhost:8080,http://localhost:4177,http://127.0.0.1:4177').split(',').map(origin=>origin.trim()).filter(Boolean);
export async function handleRequest(req:Request):Promise<Response>{
 const origin=req.headers.get('Origin');const headers:Record<string,string>={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin','Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info,idempotency-key','Access-Control-Allow-Methods':'POST,OPTIONS',...(origin&&allowedOrigins.includes(origin)?{'Access-Control-Allow-Origin':origin}:{})};
 const response=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
 if(origin&&!allowedOrigins.includes(origin))return response({error:'不允许的来源',code:'ORIGIN_NOT_ALLOWED'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});if(req.method!=='POST')return response({error:'仅支持 POST',code:'METHOD_NOT_ALLOWED'},405);
 try{
  const authorization=req.headers.get('Authorization');if(!authorization?.startsWith('Bearer '))throw new NewspaperError('UNAUTHORIZED','请先登录',401);
  const url=Deno.env.get('SUPABASE_URL')!,anon=Deno.env.get('SUPABASE_ANON_KEY')!;
  const db=createClient(url,anon,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
  const {data,error}=await db.auth.getClaims(authorization.slice(7));if(error||!data?.claims?.sub)throw new NewspaperError('UNAUTHORIZED','登录已过期，请重新登录',401);
  if(Number(req.headers.get('Content-Length')??0)>12_000_000)throw new NewspaperError('INVALID_INPUT','请求内容过大');
  const raw=await req.text();if(raw.length>12_000_000)throw new NewspaperError('INVALID_INPUT','请求内容过大');let body:any;try{body=JSON.parse(raw);}catch{throw new NewspaperError('INVALID_INPUT','请求格式无效');}
  if(!body||typeof body.action!=='string'||(body.input!==undefined&&(!body.input||typeof body.input!=='object'||Array.isArray(body.input))))throw new NewspaperError('INVALID_INPUT','报纸操作格式无效');
  const action=body.action,input=body.input??{};const uiActions:Record<string,'read'|'write'|'delete'>={preferences_get:'read',preferences_save:'write',image_config_get:'read',image_config_save:'write',reference_upload:'write'};
  const operation=NEWSPAPER_OPERATIONS[action]?.permission??uiActions[action];if(!operation)throw new NewspaperError('ACTION_NOT_ALLOWED','不支持的报纸操作',404);
  if(data.claims.client_id&&uiActions[action])throw new NewspaperError('BROWSER_SESSION_REQUIRED','此设置只能由网页账户修改',403);
  const {data:authorized,error:authError}=await db.rpc('newspaper_authorize',{p_operation:operation});if(authError||!authorized)throw new NewspaperError('PERMISSION_DENIED','未获此操作权限',403);
  const {data:canRead}=operation==='read'?{data:true}:await db.rpc('newspaper_authorize',{p_operation:'read'});if(!canRead)throw new NewspaperError('PERMISSION_DENIED','此操作需要读取权限',403);
  // This credential is introduced only after a verified JWT and a live permission check.
  const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  const ctx:NewspaperContext={db,admin,userId:data.claims.sub,permissions:{read:true,write:operation==='write',delete:operation==='delete'},idempotencyKey:req.headers.get('Idempotency-Key')??body.idempotency_key};
  if(['user_id','userId','admin','permissions'].some(k=>k in input))throw new NewspaperError('INVALID_INPUT','不接受身份或权限字段');
  let result:unknown;
  if(action.startsWith('preferences_'))result=await createNewspaperService(ctx).execute(action,input);
  else if(uiActions[action])result=await createNewspaperImageService(ctx).execute(action,input);
  else result=await executeNewspaperOperation(ctx,action,input);
  return response({data:result});
 }catch(error){const e=error instanceof NewspaperError?error:new NewspaperError('INTERNAL_ERROR','操作暂时无法完成，请稍后重试',500);return response({error:e.message,code:e.code},e.status);}
}
Deno.serve(handleRequest);
