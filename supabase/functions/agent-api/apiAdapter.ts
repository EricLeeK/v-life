import {CLASSIFICATION_MODULES,CLASSIFICATION_WORKFLOW} from '../_shared/agentClassifications.ts';
import { fieldsSchema } from '../mcp-server/mcpAdapter.ts';
import { schemaForField } from '../mcp-server/toolSchema.ts';
import { toolDescription, GUIDE_TOPICS } from '../_shared/agentGuide.ts';
import { MODULES, moduleByKey, agentMetaOf, type FieldDef, type ModuleDef } from '../_shared/moduleRegistry.ts';
import type { AgentListOptions } from '../_shared/agentDataService.ts';
import { AGENT_CONTRACT_VERSION } from '../_shared/agentCapabilities.ts';

export type ApiRoute =
  | { action: 'capabilities' | 'openapi' | 'guide' }
  | { action: 'classifications'; module:string }
  | { action: 'summary'; name: string }
  | { action: 'list' | 'create'; module: string }
  | { action: 'get' | 'update' | 'delete'; module: string; id: string }
  | { action: 'export'; module: string }
  | { action: 'not_found' | 'method_not_allowed' };

export function parseApiListOptions(url:URL,module?:string):AgentListOptions {
 const number=(name:string)=>url.searchParams.has(name)?Number(url.searchParams.get(name)):undefined;
 const reserved=new Set(['limit','offset','date_from','date_to','q']);const filters:Record<string,unknown>={};
 for(const [key,value] of url.searchParams)if(!reserved.has(key))filters[key]=value==='null'&&module&&moduleByKey[module]?.fields.find(field=>field.name===key)?.nullable?null:value;
 return {limit:number('limit'),offset:number('offset'),date_from:url.searchParams.get('date_from')??undefined,date_to:url.searchParams.get('date_to')??undefined,filters};
}

export function parseApiRoute(pathname: string, method: string): ApiRoute {
  const marker = '/api/v1';
  const at = pathname.indexOf(marker);
  if (at < 0) return { action: 'not_found' };
  const parts = pathname.slice(at + marker.length).split('/').filter(Boolean).map(decodeURIComponent);
  if (parts.length === 1 && parts[0] === 'guide') return method === 'GET' ? { action: 'guide' } : { action: 'method_not_allowed' };
  if (parts.length === 1 && parts[0] === 'capabilities') return method === 'GET' ? { action: 'capabilities' } : { action: 'method_not_allowed' };
  if (parts.length === 1 && parts[0] === 'openapi.json') return method === 'GET' ? { action: 'openapi' } : { action: 'method_not_allowed' };
  if (parts.length === 2 && parts[1] === 'classifications') return method === 'GET' ? {action:'classifications',module:parts[0]} : {action:'method_not_allowed'};
  if (parts.length === 2 && parts[0] === 'summary') return method === 'GET' ? { action: 'summary', name: parts[1] } : { action: 'method_not_allowed' };
  if (parts.length === 2 && parts[1] === 'export') return method === 'GET' ? { action: 'export', module: parts[0] } : { action: 'method_not_allowed' };
  if (parts.length === 1) {
    if (method === 'GET') return { action: 'list', module: parts[0] };
    if (method === 'POST') return { action: 'create', module: parts[0] };
    return { action: 'method_not_allowed' };
  }
  if (parts.length === 2) {
    const action = method === 'GET' ? 'get' : method === 'PATCH' || method === 'PUT' ? 'update' : method === 'DELETE' ? 'delete' : null;
    return action ? { action, module: parts[0], id: parts[1] } : { action: 'method_not_allowed' };
  }
  return { action: 'not_found' };
}

function writeSchema(module: ModuleDef, operation: 'create' | 'update') {
 const schema=fieldsSchema(module,operation);
 delete schema.properties.id; delete schema.properties.idempotency_key;
 schema.required=schema.required.filter((key:string)=>key!=='id');
 return schema;
}

export function buildOpenApi(baseUrl: string, authorizationServer: string) {
  const paths: Record<string, unknown> = {};
  for (const module of MODULES.filter((item) => agentMetaOf(item).agentVisible)) {
    const collection: Record<string, unknown> = {
      get: { operationId: `${module.key}_list`, summary: `分页读取${module.labelZh}`, description: toolDescription(module, 'list'), parameters: pageParameters(module), responses: okResponse() },
    };
    if (module.actions.create) collection.post = { operationId: `${module.key}_create`, description: toolDescription(module,'create').replace('id/user_id','record identity'), summary: `新增${module.labelZh}`, parameters: idempotencyParameter(), requestBody: jsonBody(writeSchema(module, 'create')), responses: mutationResponses() };
    paths[`/${module.key}`] = collection;
    const item: Record<string, unknown> = {
      get: { operationId: `${module.key}_get`, summary: `读取单条${module.labelZh}`, responses: okResponse() },
    };
    if (module.actions.update) item.patch = { operationId: `${module.key}_update`, description: toolDescription(module,'update').replace('id/user_id','record identity'), summary: `修改${module.labelZh}`, parameters: idempotencyParameter(), requestBody: jsonBody(writeSchema(module, 'update')), responses: mutationResponses() };
    if (module.actions.delete) item.delete = { operationId: `${module.key}_delete`, description: toolDescription(module,'delete').replace('id/user_id','record identity'), summary: `删除${module.labelZh}`, parameters: idempotencyParameter(), responses: mutationResponses() };
    paths[`/${module.key}/{id}`] = { parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], ...item };
    if (agentMetaOf(module).exportable) paths[`/${module.key}/export`] = { get: { operationId: `${module.key}_export`, summary: `分页导出${module.labelZh}`, description: toolDescription(module, 'list'), parameters: pageParameters(module), responses: okResponse() } };
  }
  paths['/{module}/classifications']={get:{operationId:'classification_list',description:CLASSIFICATION_WORKFLOW,parameters:[{name:'module',in:'path',required:true,schema:{type:'string',enum:CLASSIFICATION_MODULES}},...pageParameters().filter(p=>['limit','offset'].includes(p.name))],responses:okResponse()}};
  paths['/guide'] = { get: { operationId: 'agent_guide', summary: '首次接入指南、当前权限和业务日期；支持订阅、待办、财务、分类等指南', parameters: [{name:'topic',in:'query',schema:{type:'string',enum:[...GUIDE_TOPICS]}}], responses: okResponse() } };
  paths['/capabilities'] = { get: { operationId: 'capabilities', responses: okResponse() } };
  paths['/summary/{name}'] = { get: { operationId: 'summary', parameters: [{ name: 'name', in: 'path', required: true, schema: { type: 'string' } }, ...pageParameters()], responses: okResponse() } };
  paths['/summary/subscription']={get:{operationId:'subscription_summary',summary:'订阅月均预算与未来30天预计扣费，各币种独立汇总',description:'预算不等于实际支出；固定与按量预估分别返回。默认北京时间今日。',parameters:[{name:'as_of_date',in:'query',schema:{type:'string',format:'date'}}],responses:okResponse()}};
  return {
    openapi: '3.1.0',
    info: { title: 'V-Life Agent API', version: AGENT_CONTRACT_VERSION },
    servers: [{ url: baseUrl }],
    security: [{ oauth2: [] }],
    paths,
    components: { securitySchemes: { oauth2: { type: 'oauth2', flows: { authorizationCode: { authorizationUrl: `${authorizationServer}/authorize`, tokenUrl: `${authorizationServer}/token`, scopes: {} } } } } },
  };
}

function pageParameters(module?: ModuleDef) {
  return [
    { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 200, default: 50 } },
    { name: 'offset', in: 'query', schema: { type: 'integer', minimum: 0, default: 0 } },
    ...(module && !module.executor?.dateField ? [] : [{ name: 'date_from', in: 'query', schema: { type: 'string', format: 'date' } },
    { name: 'date_to', in: 'query', schema: { type: 'string', format: 'date' } }]),
    ...(module&&['subscription','subscription_payment'].includes(module.key)?agentMetaOf(module).readFields.map(name=>({name,in:'query',description:'精确相等筛选；可空字段使用文本 null 筛选空值。',schema:module.fields.some(field=>field.name===name)?schemaForField(module.fields.find(field=>field.name===name)!):{type:'string'}})):[]),
  ];
}
function idempotencyParameter() { return [{ name: 'Idempotency-Key', in: 'header', schema: { type: 'string', maxLength: 200 } }]; }
function jsonBody(schema: unknown) { return { required: true, content: { 'application/json': { schema } } }; }
function okResponse() { return { 200: { description: 'Success', content: { 'application/json': { schema: { type: 'object' } } } }, 401: { description: 'OAuth required' }, 403: { description: 'Permission denied' } }; }
function mutationResponses() { return { ...okResponse(), 400: { description: 'Invalid input' }, 404: { description: 'Record not found' }, 409: { description: 'Conflict' } }; }
