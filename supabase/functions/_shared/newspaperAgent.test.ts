import { describe, expect, it } from 'vitest';
import { parseApiRoute, buildOpenApi } from '../agent-api/apiAdapter';
import { buildAgentCapabilities } from './agentCapabilities';
import { validateNewspaperOperation } from './newspaperOperations';

describe('newspaper Agent transport contract', () => {
  it('routes report reads separately from generic module CRUD', () => {
    expect(parseApiRoute('/api/v1/newspaper', 'GET')).toEqual({ action: 'newspaper', operation: 'list' });
    expect(parseApiRoute('/api/v1/newspaper/get', 'GET')).toEqual({ action: 'newspaper', operation: 'get' });
    expect(parseApiRoute('/api/v1/newspaper/image_generate', 'GET')).toEqual({ action: 'method_not_allowed' });
    expect(parseApiRoute('/api/v1/newspaper/image_generate', 'POST')).toEqual({ action: 'newspaper', operation: 'image_generate' });
  });
  it('does not expose credential configuration through the Agent API', () => {
    expect(parseApiRoute('/api/v1/newspaper/image_config_save', 'POST')).toEqual({ action: 'not_found' });
    const paths = buildOpenApi('https://example.test/api/v1', 'https://auth.test').paths as Record<string, any>;
    expect(paths['/newspaper/image_generate'].post.parameters).toContainEqual(expect.objectContaining({ name: 'Idempotency-Key', required: true }));
    expect(JSON.stringify(paths['/newspaper/style_save'])).not.toContain('api_key');
    expect(paths['/newspaper/image_config_save']).toBeUndefined();
  });
  it('advertises optional generation and immutable archived source material', () => {
    expect(buildAgentCapabilities()).toHaveProperty('newspapers.generation', 'explicit_only');
    expect(buildAgentCapabilities()).toHaveProperty('newspapers.archived_sources', 'snapshot_explicit_refresh');
  });
  it('rejects a paid request without a key and accepts a retry with the original key', () => {
    const ctx = { db: null, userId: 'owner', permissions: { read: true, write: true, delete: false } };
    expect(() => validateNewspaperOperation(ctx, 'image_generate', { date: '2026-09-28' })).toThrow('Idempotency-Key');
    expect(validateNewspaperOperation({ ...ctx, idempotencyKey: 'request-a' }, 'image_generate', { date: '2026-09-28' })).toEqual({ date: '2026-09-28' });
  });
  it('does not let an OAuth caller inject another owner or use read grants to generate', () => {
    const ctx = { db: null, userId: 'owner', permissions: { read: true, write: false, delete: false }, idempotencyKey: 'request-a' };
    expect(() => validateNewspaperOperation(ctx, 'image_generate', { date: '2026-09-28' })).toThrow('permission');
    expect(() => validateNewspaperOperation(ctx, 'get', { date: '2026-09-28', user_id: 'other' })).toThrow('unknown field');
    expect(() => validateNewspaperOperation(ctx, 'image_config_get', {})).toThrow('Unknown');
  });
});
