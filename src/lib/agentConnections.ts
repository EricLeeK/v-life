export type AgentPermissions = { read_enabled: boolean; write_enabled: boolean; delete_enabled: boolean };
export type AgentAccess = AgentPermissions & { user_id: string; client_id: string; client_name: string; revoked_at: string | null; last_used_at?: string | null };
export function safeConsentReturnTo(value: string | null): string {
  if (!value || !value.startsWith('/oauth/consent?') || value.includes('\\')) return '/';
  const parsed = new URL(value, 'https://vlife.invalid');
  return parsed.origin === 'https://vlife.invalid' && parsed.pathname === '/oauth/consent' && parsed.searchParams.get('authorization_id') ? `${parsed.pathname}${parsed.search}` : '/';
}
export function oauthClientId(client: { id?: string; client_id?: string }): string {
  const id = client.client_id || client.id;
  if (!id) throw new Error('授权请求缺少 Agent 标识。');
  return id;
}
export async function approveAgent<T>({ save, approve }: { save: () => Promise<unknown>; approve: () => Promise<T> }): Promise<T> {
  await save();
  return approve();
}
export async function revokeAgentAccess({ block, revoke }: { block: () => Promise<unknown>; revoke: () => Promise<unknown> }) {
  await block();
  try { await revoke(); return { blocked: true, oauthError: null }; }
  catch (error) { return { blocked: true, oauthError: error instanceof Error ? error.message : String(error) }; }
}
