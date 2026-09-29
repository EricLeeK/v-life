import { webcrypto } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { executeNewspaperChatOperation } from './newspaperChat';
import { newspaperPaidRequestStore } from './newspaperPaidRequests';

describe('newspaper chat execution', () => {
  beforeEach(() => { sessionStorage.clear(); vi.stubGlobal('crypto', webcrypto); });
  it('keeps the request key on uncertain retries and reports queued work honestly', async () => {
    const operation = { module: 'newspaper', action: 'image_generate', data: { date: '2026-09-28' } };
    const call = vi.fn().mockRejectedValueOnce(new Error('network')).mockResolvedValue({ id: 'job', status: 'queued' });
    await expect(executeNewspaperChatOperation(operation, call, 'user-a')).rejects.toThrow('network');
    const result = await executeNewspaperChatOperation(operation, call, 'user-a');
    expect(call.mock.calls[0][2]).toBe(call.mock.calls[1][2]);
    expect(result).toContain('排队');
    expect(result).not.toContain('已生成');
  });
  it('rejects unknown operations before any request', async () => {
    const call = vi.fn();
    await expect(executeNewspaperChatOperation({ module: 'newspaper', action: 'image_config_save', data: { api_key: 'secret' } }, call, 'user-a')).rejects.toThrow('不支持');
    expect(call).not.toHaveBeenCalled();
  });
  it('reuses a pending webpage request when the same operation is retried from chat', async () => {
    const data = { date: '2026-09-28', section_id: 'main' };
    const webpage = vi.fn().mockRejectedValue(new Error('connection lost'));
    await expect(newspaperPaidRequestStore().run('user-a', 'image_generate', data, webpage)).rejects.toThrow();
    const operation = { module: 'newspaper', action: 'image_generate', data, idempotency_key: 'chat-new-key' };
    const call = vi.fn().mockResolvedValue({ id: 'same-job', status: 'running' });
    await executeNewspaperChatOperation(operation, call, 'user-a');
    expect(call.mock.calls[0][2]).toBe(webpage.mock.calls[0][0]);
    expect(operation.idempotency_key).toBe(webpage.mock.calls[0][0]);
  });
});
