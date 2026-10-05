import { supabase } from '@/integrations/supabase/client';
import type { AgentKey, CreatedAgentKey } from './agentKeys';

const fields = 'user_id,client_id,client_name,credential_type,key_prefix,read_enabled,write_enabled,delete_enabled,created_at,expires_at,revoked_at,last_used_at';
function check(error: { message: string } | null) { if (error) throw new Error(error.message); }
export async function listAgentKeys(userId: string): Promise<AgentKey[]> {
  const { data, error } = await supabase.from('agent_client_access' as never).select(fields)
    .eq('user_id', userId).eq('credential_type', 'api_key').order('created_at', { ascending: false });
  check(error);
  return (data ?? []) as unknown as AgentKey[];
}
export async function createAgentKey(input: { name: string; expiresAt: string | null; read: boolean; write: boolean; delete: boolean }): Promise<CreatedAgentKey> {
  const { data, error } = await supabase.rpc('agent_create_api_key' as never, {
    p_name: input.name, p_expires_at: input.expiresAt, p_read_enabled: input.read,
    p_write_enabled: input.write, p_delete_enabled: input.delete,
  } as never);
  check(error);
  const result = data as unknown as CreatedAgentKey;
  if (!result?.api_key || !result?.client_id) throw new Error('API_KEY_RESPONSE_INCOMPLETE');
  return result;
}
export async function revokeAgentKey(clientId: string) {
  const { error } = await supabase.rpc('agent_revoke_api_key' as never, { p_client_id: clientId } as never);
  check(error);
}
