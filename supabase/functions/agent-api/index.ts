import { buildAgentGuide, GUIDE_TOPICS, errorRecovery, type GuideTopic } from '../_shared/agentGuide.ts';
import { withAgentAuth } from '../_shared/agentAuth.ts';
import { createAgentDataService, AgentDataError, type AgentContext, type AgentListOptions } from '../_shared/agentDataService.ts';
import { buildAgentCapabilities } from '../_shared/agentCapabilities.ts';
import { buildOpenApi, parseApiRoute, parseApiListOptions } from './apiAdapter.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { NEWSPAPER_OPERATIONS } from '../_shared/newspaperAgent.ts';
import { executeNewspaperOperation } from '../_shared/newspaperOperations.ts';
import { NewspaperError } from '../_shared/newspaperTypes.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const authorizationServer = `${supabaseUrl}/auth/v1`;
const publicBaseUrl = (Deno.env.get('AGENT_API_PUBLIC_URL') ?? 'https://shenghuo.homes/api/v1').replace(/\/$/, '');

function response(body: unknown, status = 200, requestId?: string) {
  return Response.json(body, { status, headers: { 'Cache-Control': 'no-store', ...(requestId ? { 'X-Request-Id': requestId } : {}) } });
}

function errorStatus(code: string) {
  if (code === 'PERMISSION_DENIED') return 403;
  if (code === 'NOT_FOUND' || code === 'MODULE_NOT_FOUND') return 404;
  if (code === 'CONFLICT' || code === 'IDEMPOTENCY_CONFLICT') return 409;
  if (code === 'INTERNAL_ERROR' || code === 'DATABASE_ERROR') return 500;
  return 400;
}

const listOptions=parseApiListOptions;

async function body(req: Request) {
  const length = Number(req.headers.get('content-length') ?? 0);
  if (length > 1_000_000) throw new AgentDataError('INVALID_INPUT', 'Request body is too large');
  try { return await req.json(); } catch { throw new AgentDataError('INVALID_INPUT', 'Request body must be valid JSON'); }
}

const protectedHandler = withAgentAuth(publicBaseUrl, async (req, context) => {
  const { db, requestId } = context;
  const audit=async(args:Record<string,unknown>)=>{try {const {error}=await db.rpc('agent_log_operation',args);if(error)console.error('agent audit unavailable',requestId);}catch {console.error('agent audit unavailable',requestId);}};
  const service = createAgentDataService(context);
  const url = new URL(req.url);
  const route = parseApiRoute(url.pathname, req.method);
  if (route.action === 'not_found') return response({ ok: false, error: { code: 'NOT_FOUND', message: 'Endpoint not found' }, request_id: requestId }, 404, requestId);
  if (route.action === 'method_not_allowed') return response({ ok: false, error: { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' }, request_id: requestId }, 405, requestId);

  const toolName = route.action === 'newspaper' ? `newspaper_${route.operation}` : route.action === 'task_overview' ? 'daily_task_overview' : route.action === 'task_transfer' ? 'daily_task_transfer' : route.action === 'summary' ? `summary_${route.name}` : 'module' in route ? `${route.module}_${route.action}` : route.action;
  context.toolName = toolName;
  try {
    let result: unknown;
    if (route.action === 'newspaper') {
      let input: Record<string, unknown>;
      if (req.method === 'GET') {
        input = {};
        const properties = NEWSPAPER_OPERATIONS[route.operation].schema.properties;
        for (const [key, value] of url.searchParams) {
          const type = properties[key]?.type;
          input[key] = type === 'integer' ? Number(value) : type === 'boolean' ? value === 'true' ? true : value === 'false' ? false : value : type === 'array' ? value.split(',').filter(Boolean) : value;
        }
      } else input = await body(req);
      const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
      result = { data: await executeNewspaperOperation({ ...context, admin }, route.operation, input) };
    }
    else if (route.action === 'task_overview') {
      const args:Record<string,unknown>=Object.fromEntries(url.searchParams);
      if(typeof args.lookback_days==='string' && args.lookback_days.trim()!=='')args.lookback_days=Number(args.lookback_days);
      result=await service.taskOverview(args);
    }
    else if (route.action === 'task_transfer') result=await service.transferDailyTasks(await body(req));
    else if (route.action === 'capabilities') result = { data: buildAgentCapabilities() };
    else if (route.action === 'guide') {
      const topic=url.searchParams.get('topic')??'quickstart';
      if(!GUIDE_TOPICS.includes(topic as GuideTopic))throw new AgentDataError('INVALID_INPUT','Unknown guide topic');
      result={data:{...buildAgentGuide(topic as GuideTopic),session:{permissions:context.permissions,business_date:context.permissions.read||context.permissions.write?await service.businessDate():null,timezone:'Asia/Shanghai'}}};
    }
    else if (route.action === 'openapi') result = { data: buildOpenApi(publicBaseUrl, authorizationServer) };
    else if (route.action === 'classifications') result=await service.classifications(route.module,listOptions(url));
    else if (route.action === 'summary') result = route.name === 'finance' ? await service.financeSummary(listOptions(url)) : route.name==='subscription' ? await service.subscriptionSummary(url.searchParams.get('as_of_date')??undefined) : await service.summary(route.name, listOptions(url));
    else if (route.action === 'list') {
      const query = url.searchParams.get('q');
      result = query ? await service.search(route.module, query, listOptions(url,route.module)) : await service.list(route.module, listOptions(url,route.module));
    } else if (route.action === 'export') result = await service.export(route.module, listOptions(url,route.module));
    else if (route.action === 'get') result = await service.get(route.module, route.id);
    else if (route.action === 'create') result = await service.create(route.module, await body(req));
    else if (route.action === 'update') result = await service.update(route.module, route.id, await body(req));
    else if (route.action === 'delete') result = await service.delete(route.module, route.id);
    else throw new AgentDataError('NOT_FOUND', 'Endpoint not found');
    const recordId = typeof (result as any)?.data?.id === 'string' ? (result as any).data.id : null;
    if(!['subscription_payment_create','daily_task_transfer'].includes(toolName))await audit( { p_tool_name: toolName, p_operation: route.action, p_record_id: recordId, p_request_id: requestId, p_success: true, p_error_code: null });
    return response({ ok: true, ...(result as object), request_id: requestId }, 200, requestId);
  } catch (cause) {
    const caught = cause instanceof AgentDataError || cause instanceof NewspaperError ? cause : new AgentDataError('INTERNAL_ERROR', 'The operation could not be completed');
    await audit( { p_tool_name: toolName, p_operation: route.action, p_record_id: 'id' in route ? route.id : null, p_request_id: requestId, p_success: false, p_error_code: caught.code });
    return response({ ok: false, error: { code: caught.code, message: caught.message, ...errorRecovery(caught.code) }, request_id: requestId }, errorStatus(caught.code), requestId);
  }
});


export async function handleRequest(req: Request) {
  const origin = req.headers.get('origin');
  const allowed = (Deno.env.get('AGENT_API_ALLOWED_ORIGINS') ?? 'https://shenghuo.homes,http://localhost:5173').split(',');
  if (origin && !allowed.includes(origin)) return response({ error: 'ORIGIN_NOT_ALLOWED' }, 403);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': origin ?? '*', 'Access-Control-Allow-Headers': 'Authorization,Content-Type,Idempotency-Key,X-Request-Id', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS' } });
  const result = await protectedHandler(req);
  const headers = new Headers(result.headers);
  if (origin) headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Expose-Headers', 'WWW-Authenticate,X-Request-Id');
  headers.set('Cache-Control', 'no-store');
  return new Response(result.body, { status: result.status, headers });
}

if (import.meta.main) Deno.serve(handleRequest);
