import { describe, expect, it, vi } from 'vitest';
import { safeConsentReturnTo, approveAgent, revokeAgentAccess } from './agentConnections';
describe('agent authorization boundaries', () => {
 it('preserves only a local consent return path', () => {
  expect(safeConsentReturnTo('/oauth/consent?authorization_id=a')).toBe('/oauth/consent?authorization_id=a');
  for (const path of ['https://evil.test', '//evil.test', '/\\evil.test', '/settings', '/oauth/consent/../admin']) expect(safeConsentReturnTo(path)).toBe('/');
 });
 it('never approves before policy storage succeeds', async () => {
  const approve = vi.fn();
  await expect(approveAgent({ save: async () => { throw Error('db failed'); }, approve })).rejects.toThrow('db failed');
  expect(approve).not.toHaveBeenCalled();
 });
 it('persists policy before approving', async () => {
  const order: string[] = [];
  await approveAgent({ save: async () => { order.push('save'); }, approve: async () => { order.push('approve'); return 'ok'; } });
  expect(order).toEqual(['save', 'approve']);
 });
 it('reports local blocking even when OAuth revocation fails', async () => {
  const result = await revokeAgentAccess({ block: async () => {}, revoke: async () => { throw Error('offline'); } });
  expect(result.blocked).toBe(true); expect(result.oauthError).toContain('offline');
 });
 it('does not claim blocked or revoke when policy update fails', async () => {
  const revoke = vi.fn();
  await expect(revokeAgentAccess({ block: async () => { throw Error('db failed'); }, revoke })).rejects.toThrow('db failed');
  expect(revoke).not.toHaveBeenCalled();
 });
});
