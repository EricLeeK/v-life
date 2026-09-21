import { useCallback, useEffect, useState } from 'react';
import type { OAuthGrant } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { oauthClientId, revokeAgentAccess, type AgentAccess } from '@/lib/agentConnections';

export function AgentConnections() {
  const { user } = useAuth();
  const [records, setRecords] = useState<AgentAccess[]>([]);
  const [grants, setGrants] = useState<OAuthGrant[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const endpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mcp-server/mcp`;
  const load = useCallback(async () => {
    if (!user) return;
    setBusy(true); setError(null);
    try {
      const [access, oauth] = await Promise.all([
        supabase.from('agent_client_access' as never).select('user_id,client_id,client_name,read_enabled,write_enabled,delete_enabled,revoked_at,last_used_at').eq('user_id', user.id),
        supabase.auth.oauth.listGrants(),
      ]);
      if (access.error) throw access.error;
      setRecords((access.data ?? []) as unknown as AgentAccess[]);
      if (oauth.error) throw new Error(`数据权限已读取，但 OAuth 连接读取失败：${oauth.error.message}`);
      setGrants(oauth.data ?? []); setLoaded(true);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  }, [user]);
  useEffect(() => { setLoaded(false); setRecords([]); setGrants([]); void load(); }, [load]);
  const revoke = async (clientId: string, name: string) => {
    if (!user) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      const revokedAt = new Date().toISOString();
      const result = await revokeAgentAccess({
        block: async () => {
          const row: AgentAccess = { user_id: user.id, client_id: clientId, client_name: name, read_enabled: false, write_enabled: false, delete_enabled: false, revoked_at: revokedAt };
          const { error: saveError } = await supabase.from('agent_client_access' as never).upsert(row as never, { onConflict: 'user_id,client_id' });
          if (saveError) throw saveError;
          setRecords((all) => [...all.filter((r) => r.client_id !== clientId), row]);
        },
        revoke: async () => { const { error: revokeError } = await supabase.auth.oauth.revokeGrant({ clientId }); if (revokeError) throw revokeError; },
      });
      if (result.oauthError) setError(`数据访问已禁止；OAuth 授权撤销失败，可点击重试撤销。${result.oauthError}`);
      else { setGrants((all) => all.filter((g) => oauthClientId(g.client) !== clientId)); setNotice('已禁止数据访问并撤销 OAuth 授权。'); }
    } catch (e) { setError(`未能禁止数据访问：${e instanceof Error ? e.message : String(e)}。请重试。`); }
    finally { setBusy(false); }
  };
  const rows = new Map(records.map((r) => [r.client_id, { id: r.client_id, name: r.client_name, record: r, grant: false }]));
  for (const grant of grants) { const id = oauthClientId(grant.client); const row = rows.get(id); rows.set(id, { id, name: grant.client.name || id, record: row?.record, grant: true }); }
  return <Card><CardHeader><CardTitle className="text-base">已连接的 Agent</CardTitle></CardHeader><CardContent className="space-y-4">
    <p className="text-sm text-muted-foreground">在 Agent 的 MCP 连接设置中填写以下地址，选择 OAuth 登录，并在 V-Life 中批准需要的数据权限。</p>
    <code className="block break-all rounded bg-muted p-3 text-xs">{endpoint}</code>
    <div className="flex gap-2"><Button variant="outline" size="sm" onClick={async () => { try { await navigator.clipboard.writeText(endpoint); setNotice('连接地址已复制。'); } catch { setError('复制失败，请手动复制上方地址。'); } }}>复制连接地址</Button><Button variant="outline" size="sm" onClick={load} disabled={busy}>{busy ? '处理中…' : '刷新连接'}</Button></div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="text-sm">{notice}</p>}
    {!loaded && !error && <p className="text-sm text-muted-foreground">正在读取连接…</p>}
    {loaded && !error && rows.size === 0 && <p className="text-sm text-muted-foreground">还没有授权的 Agent。</p>}
    {[...rows.values()].map((row) => <div key={row.id} className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm"><div><p className="font-medium">{row.name || row.id}</p><p className="text-muted-foreground">{row.record?.revoked_at ? '数据访问已禁止' : row.record ? [row.record.read_enabled && '读取', row.record.write_enabled && '新增/修改', row.record.delete_enabled && '删除'].filter(Boolean).join(' · ') || '无数据权限' : 'OAuth 已连接，尚未授予数据权限'}</p>{row.record?.last_used_at && <p className="text-xs text-muted-foreground">最近使用：{new Date(row.record.last_used_at).toLocaleString()}</p>}</div><Button variant="destructive" size="sm" disabled={busy || (!!row.record?.revoked_at && !row.grant)} onClick={() => revoke(row.id, row.name)}>{row.record?.revoked_at && row.grant ? '重试撤销 OAuth' : '撤销连接'}</Button></div>)}
  </CardContent></Card>;
}
