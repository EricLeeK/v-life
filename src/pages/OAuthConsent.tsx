import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { OAuthAuthorizationDetails } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { approveAgent, oauthClientId, type AgentPermissions } from "@/lib/agentConnections";

export default function OAuthConsentPage() {
  const { user, loading } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const authorizationId = params.get("authorization_id");
  const [details, setDetails] = useState<OAuthAuthorizationDetails | null>(null);
  const [redirect, setRedirect] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [permissions, setPermissions] = useState<AgentPermissions>({ read_enabled: true, write_enabled: false, delete_enabled: false });

  useEffect(() => {
    if (!loading && !user) navigate(`/auth?returnTo=${encodeURIComponent(`/oauth/consent?${params.toString()}`)}`, { replace: true });
  }, [loading, user, navigate, params]);

  useEffect(() => {
    if (!authorizationId || !user) return;
    let active = true;
    setDetails(null); setRedirect(null); setError(null);
    setPermissions({ read_enabled: true, write_enabled: false, delete_enabled: false });
    supabase.auth.oauth.getAuthorizationDetails(authorizationId).then(({ data, error: requestError }) => {
      if (!active) return;
      if (requestError) throw requestError;
      if (data && "redirect_url" in data) setRedirect(data.redirect_url);
      else if (data) setDetails(data as OAuthAuthorizationDetails);
      else setError("无法读取授权请求，请重新连接。");
    }).catch((e) => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [authorizationId, user]);

  const decide = async (approve: boolean) => {
    if (!authorizationId || !user || !details) return;
    setBusy(true); setError(null);
    try {
      const result = approve ? await approveAgent({
        save: async () => {
          const { error: saveError } = await supabase.from("agent_client_access" as never).upsert({ user_id: user.id, client_id: oauthClientId(details.client), client_name: details.client.name, ...permissions, revoked_at: null } as never, { onConflict: "user_id,client_id" });
          if (saveError) throw saveError;
        },
        approve: () => supabase.auth.oauth.approveAuthorization(authorizationId, { skipBrowserRedirect: true }),
      }) : await supabase.auth.oauth.denyAuthorization(authorizationId, { skipBrowserRedirect: true });
      if (result.error) throw result.error;
      if (!result.data?.redirect_url) throw new Error("授权服务未返回跳转地址，请重试。");
      window.location.assign(result.data.redirect_url);
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  if (loading || !user) return <div className="p-8 text-center">加载中…</div>;
  if (!authorizationId) return <div className="p-8 text-center">缺少授权请求。</div>;
  return <div className="min-h-screen flex items-center justify-center bg-background p-4"><Card className="w-full max-w-lg">
    <CardHeader><CardTitle>连接 V-Life Agent</CardTitle></CardHeader>
    <CardContent className="space-y-5">
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {!details && !redirect && !error && <p>正在读取授权请求…</p>}
      {redirect && <><p>此 Agent 已获得 OAuth 授权。继续连接会沿用已保存的数据权限，不会新增或升级权限。</p><p className="text-sm text-muted-foreground">如果连接被禁止，请到设置中撤销旧连接，再由 Agent 发起新的授权请求。</p><Button onClick={() => window.location.assign(redirect)}>继续连接</Button></>}
      {details && <>
        <p><strong>{details.client.name || "Agent"}</strong> 请求访问你的 V-Life 数据。</p>
        <p className="text-sm text-muted-foreground break-all">回调地址：{details.redirect_uri}</p>
        <fieldset disabled={busy} className="space-y-3"><legend className="mb-3 font-medium">允许的数据操作</legend>
          {([['read_enabled', '读取数据'], ['write_enabled', '新增和修改数据'], ['delete_enabled', '删除数据']] as const).map(([key, label]) => <label key={key} className="flex items-center gap-3"><input type="checkbox" checked={permissions[key]} onChange={(e) => setPermissions((p) => ({ ...p, [key]: e.target.checked }))} />{label}</label>)}
        </fieldset>
        <p className="text-sm text-muted-foreground">仅访问你的数据；API Key、视觉 Key 和日历订阅 Token 不会提供给 Agent。</p>
        <div className="flex gap-3 justify-end"><Button variant="outline" onClick={() => decide(false)} disabled={busy}>拒绝</Button><Button onClick={() => decide(true)} disabled={busy}>{busy ? "处理中…" : "允许访问"}</Button></div>
      </>}
    </CardContent></Card></div>;
}
