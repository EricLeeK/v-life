import { assert, assertEquals } from 'jsr:@std/assert@1';
import { buildOpenApi, parseApiRoute } from './apiAdapter.ts';

Deno.test('routes every documented JSON API shape', () => {
  assertEquals(parseApiRoute('/functions/v1/agent-api/api/v1/todo', 'GET'), { action: 'list', module: 'todo' });
  assertEquals(parseApiRoute('/api/v1/todo', 'POST'), { action: 'create', module: 'todo' });
  assertEquals(parseApiRoute('/api/v1/todo/123', 'PATCH'), { action: 'update', module: 'todo', id: '123' });
  assertEquals(parseApiRoute('/api/v1/todo/export', 'GET'), { action: 'export', module: 'todo' });
  assertEquals(parseApiRoute('/api/v1/summary/finance', 'GET'), { action: 'summary', name: 'finance' });
  assertEquals(parseApiRoute('/api/v1/capabilities', 'GET'), { action: 'capabilities' });
});

Deno.test('OpenAPI is registry-derived and does not expose identity or sensitive settings', () => {
  const document = buildOpenApi('https://shenghuo.homes/api/v1', 'https://example.supabase.co/auth/v1') as any;
  assertEquals(document.openapi, '3.1.0');
  assert(document.paths['/todo']);
  assert(document.paths['/todo/{id}']);
  assert(!JSON.stringify(document).includes('user_id'));
  assert(!JSON.stringify(document).includes('ai_api_key'));
  assertEquals(document.components.securitySchemes.oauth2.flows.authorizationCode.tokenUrl, 'https://example.supabase.co/auth/v1/token');
});

Deno.test('HTTP onboarding and write schemas agree with MCP task workflows',()=>{
 assertEquals(parseApiRoute('/api/v1/guide','GET'),{action:'guide'});
 const doc:any=buildOpenApi('https://example.test/api/v1','https://example.test/auth/v1');
 assert(doc.paths['/guide']);
 const schema=doc.paths['/habit_log'].post.requestBody.content['application/json'].schema;
 assert(!schema.required.includes('title'));assertEquals(schema.anyOf,[{required:['todo_id']},{required:['title']}]);
 assert(doc.paths['/todo'].get.parameters.some((p:any)=>p.name==='date_from'));
 assert(doc.paths['/todo/{id}'].patch.description.includes('同步'));
});
Deno.test('HTTP publishes subscriptions, dedicated payment confirmation and currency-separated summaries',()=>{
 const doc:any=buildOpenApi('https://example.test/api/v1','https://example.test/auth');
 assertEquals(parseApiRoute('/api/v1/subscription_payment','POST'),{action:'create',module:'subscription_payment'});
 const input=doc.paths['/subscription_payment'].post.requestBody.content['application/json'].schema;
 assert(input.required.includes('subscription_id'));assert(input.required.includes('due_date'));assert(!('user_id' in input.properties));
 assert(!doc.paths['/subscription_payment/{id}'].patch);assert(!doc.paths['/subscription_payment/{id}'].delete);
 assertEquals(doc.paths['/summary/subscription'].get.operationId,'subscription_summary');
 assertEquals(doc.paths['/subscription'].post.requestBody.content['application/json'].schema.properties.reminder_days.type,['integer','null']);
});
Deno.test('HTTP exposes classification discovery with matching module policy',()=>{
 assertEquals(parseApiRoute('/api/v1/todo/classifications','GET'),{action:'classifications',module:'todo'});
 const doc:any=buildOpenApi('https://example.test/api/v1','https://example.test/auth');
 assert(doc.paths['/{module}/classifications'].get.parameters[0].schema.enum.includes('daily_task'));
 assert(doc.paths['/belongings_daily'].post.description.includes('classification_list'));
});
