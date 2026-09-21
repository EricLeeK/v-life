import { MODULES, agentMetaOf, type FieldDef, type ModuleDef } from '../_shared/moduleRegistry.ts';
import { AGENT_CONTRACT_VERSION } from '../_shared/agentCapabilities.ts';

export type ApiRoute =
  | { action: 'capabilities' | 'openapi' }
  | { action: 'summary'; name: string }
  | { action: 'list' | 'create'; module: string }
  | { action: 'get' | 'update' | 'delete'; module: string; id: string }
  | { action: 'export'; module: string }
  | { action: 'not_found' | 'method_not_allowed' };

export function parseApiRoute(pathname: string, method: string): ApiRoute {
  const marker = '/api/v1';
  const at = pathname.indexOf(marker);
  if (at < 0) return { action: 'not_found' };
  const parts = pathname.slice(at + marker.length).split('/').filter(Boolean).map(decodeURIComponent);
  if (parts.length === 1 && parts[0] === 'capabilities') return method === 'GET' ? { action: 'capabilities' } : { action: 'method_not_allowed' };
  if (parts.length === 1 && parts[0] === 'openapi.json') return method === 'GET' ? { action: 'openapi' } : { action: 'method_not_allowed' };
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

function fieldSchema(field: FieldDef) {
  const schema: Record<string, unknown> = {
    type: field.type === 'date' || field.type === 'datetime' ? 'string' : field.type,
    description: field.description ?? field.name,
  };
  if (field.type === 'date') schema.format = 'date';
  if (field.type === 'datetime') schema.format = 'date-time';
  if (field.type === 'array') schema.items = {};
  if (field.enum && field.vocab !== 'open') schema.enum = field.enum;
  return schema;
}

function writeSchema(module: ModuleDef, operation: 'create' | 'update') {
  const meta = agentMetaOf(module);
  const allowed = operation === 'create' ? meta.createFields : meta.updateFields;
  const properties = Object.fromEntries(module.fields.filter((field) => allowed.includes(field.name)).map((field) => [field.name, fieldSchema(field)]));
  const required = operation === 'create' ? module.fields.filter((field) => field.required && allowed.includes(field.name)).map((field) => field.name) : [];
  return { type: 'object', properties, required, additionalProperties: false };
}

export function buildOpenApi(baseUrl: string, authorizationServer: string) {
  const paths: Record<string, unknown> = {};
  for (const module of MODULES.filter((item) => agentMetaOf(item).agentVisible)) {
    const collection: Record<string, unknown> = {
      get: { operationId: `${module.key}_list`, summary: `分页读取${module.labelZh}`, parameters: pageParameters(), responses: okResponse() },
    };
    if (module.actions.create) collection.post = { operationId: `${module.key}_create`, summary: `新增${module.labelZh}`, parameters: idempotencyParameter(), requestBody: jsonBody(writeSchema(module, 'create')), responses: mutationResponses() };
    paths[`/${module.key}`] = collection;
    const item: Record<string, unknown> = {
      get: { operationId: `${module.key}_get`, summary: `读取单条${module.labelZh}`, responses: okResponse() },
    };
    if (module.actions.update) item.patch = { operationId: `${module.key}_update`, summary: `修改${module.labelZh}`, parameters: idempotencyParameter(), requestBody: jsonBody(writeSchema(module, 'update')), responses: mutationResponses() };
    if (module.actions.delete) item.delete = { operationId: `${module.key}_delete`, summary: `删除${module.labelZh}`, parameters: idempotencyParameter(), responses: mutationResponses() };
    paths[`/${module.key}/{id}`] = { parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }], ...item };
    if (agentMetaOf(module).exportable) paths[`/${module.key}/export`] = { get: { operationId: `${module.key}_export`, summary: `分页导出${module.labelZh}`, parameters: pageParameters(), responses: okResponse() } };
  }
  paths['/capabilities'] = { get: { operationId: 'capabilities', responses: okResponse() } };
  paths['/summary/{name}'] = { get: { operationId: 'summary', parameters: [{ name: 'name', in: 'path', required: true, schema: { type: 'string' } }, ...pageParameters()], responses: okResponse() } };
  return {
    openapi: '3.1.0',
    info: { title: 'V-Life Agent API', version: AGENT_CONTRACT_VERSION },
    servers: [{ url: baseUrl }],
    security: [{ oauth2: [] }],
    paths,
    components: { securitySchemes: { oauth2: { type: 'oauth2', flows: { authorizationCode: { authorizationUrl: `${authorizationServer}/authorize`, tokenUrl: `${authorizationServer}/token`, scopes: {} } } } } },
  };
}

function pageParameters() {
  return [
    { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 200, default: 50 } },
    { name: 'offset', in: 'query', schema: { type: 'integer', minimum: 0, default: 0 } },
    { name: 'date_from', in: 'query', schema: { type: 'string', format: 'date' } },
    { name: 'date_to', in: 'query', schema: { type: 'string', format: 'date' } },
  ];
}
function idempotencyParameter() { return [{ name: 'Idempotency-Key', in: 'header', schema: { type: 'string', maxLength: 200 } }]; }
function jsonBody(schema: unknown) { return { required: true, content: { 'application/json': { schema } } }; }
function okResponse() { return { 200: { description: 'Success', content: { 'application/json': { schema: { type: 'object' } } } }, 401: { description: 'OAuth required' }, 403: { description: 'Permission denied' } }; }
function mutationResponses() { return { ...okResponse(), 400: { description: 'Invalid input' }, 404: { description: 'Record not found' }, 409: { description: 'Conflict' } }; }
