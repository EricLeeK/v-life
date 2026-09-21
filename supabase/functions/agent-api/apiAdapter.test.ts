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
