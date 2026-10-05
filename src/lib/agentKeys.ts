import type { AgentAccess } from './agentConnections';
export type AgentKey = AgentAccess & {
  credential_type: 'api_key'; key_prefix: string; created_at: string; expires_at: string | null;
};
export type CreatedAgentKey = AgentKey & { api_key: string };
export type ExpiryChoice = '30' | '90' | 'custom' | 'never';

export function agentKeyExpiry(choice: ExpiryChoice, date: string, now = new Date()): string | null {
  if (choice === 'never') return null;
  if (choice === '30' || choice === '90') return new Date(now.getTime() + Number(choice) * 86400000).toISOString();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) throw Error('INVALID_EXPIRY_DATE');
  // A selected date is inclusive in V-Life's business timezone (Asia/Shanghai).
  const expires = new Date(Date.parse(`${date}T00:00:00+08:00`) + 86400000);
  if (expires <= now) throw Error('EXPIRY_IN_PAST');
  return expires.toISOString();
}
export function agentKeyStatus(key: { revoked_at: string | null; expires_at: string | null; last_used_at?: string | null }, now = new Date()) {
  if (key.revoked_at) return 'revoked';
  if (key.expires_at && Date.parse(key.expires_at) <= now.getTime()) return 'expired';
  return key.last_used_at ? 'active' : 'unused';
}
export function agentConnectionConfig(endpoint: string, key: string) {
  return JSON.stringify({ mcpServers: { 'v-life': { url: endpoint, headers: { Authorization: `Bearer ${key}` } } } }, null, 2);
}
