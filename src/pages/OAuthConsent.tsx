import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function OAuthConsentPage() {
  const { user, loading } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const authorizationId = params.get("authorization_id");
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!authorizationId || !user) return;
    supabase.auth.oauth.getAuthorizationDetails(authorizationId).then(({ data, error: requestError }) => {
      if (requestError) setError(requestError.message);
      else if (data && "redirect_url" in data) window.location.assign(data.redirect_url);
      else setDetails(data);
    });
  }, [authorizationId, user]);

  const decide = async (approve: boolean) => {
    if (!authorizationId) return;
    setBusy(true);
    const result = approve
      ? await supabase.auth.oauth.approveAuthorization(authorizationId, { skipBrowserRedirect: true })
      : await supabase.auth.oauth.denyAuthorization(authorizationId, { skipBrowserRedirect: true });
    if (result.error) setError(result.error.message);
    else if (result.data?.redirect_url) window.location.assign(result.data.redirect_url);
    setBusy(false);
  };

  if (loading) return <div className="p-8 text-center">加载中…</div>;
  if (!user) {
    const target = `/oauth/consent${window.location.search}`;
    navigate(`/auth?returnTo=${encodeURIComponent(target)}`, { replace: true });
    return null;
  }
  if (!authorizationId) return <div className="p-8 text-center">缺少授权请求。</div>;
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader><CardTitle>连接 V-Life Agent</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          {error && <p className="text-sm text-destructive">{error}</p>}
          {details && <>
            <p><strong>{details.client?.name || "Agent"}</strong> 请求访问你的 V-Life 数据。</p>
            <p className="text-sm text-muted-foreground">权限：{details.scope || "openid"}</p>
            <p className="text-sm text-muted-foreground break-all">回调地址：{details.redirect_uri}</p>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => decide(false)} disabled={busy}>拒绝</Button>
              <Button onClick={() => decide(true)} disabled={busy}>允许访问</Button>
            </div>
          </>}
        </CardContent>
      </Card>
    </div>
  );
}
