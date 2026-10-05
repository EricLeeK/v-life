import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, Copy, KeyRound, RefreshCw, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useDemoMode } from '@/contexts/DemoModeContext';
import { useLang } from '@/contexts/LanguageContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { DateField } from '@/components/arc/DateField';
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from '@/components/ui/alert-dialog';
import { agentConnectionConfig, agentKeyExpiry, agentKeyStatus, type AgentKey, type CreatedAgentKey, type ExpiryChoice } from '@/lib/agentKeys';
import { createAgentKey, listAgentKeys, revokeAgentKey } from '@/lib/agentKeyStore';
import { AgentOAuthConnections } from './AgentOAuthConnections';

export function AgentConnections() {
  const { user } = useAuth();
  const userId = user?.id;
  const { isDemo, exitDemo } = useDemoMode();
  const { t, lang } = useLang();
  const [keys, setKeys] = useState<AgentKey[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [listError, setListError] = useState(false);
  const [name, setName] = useState('');
  const [expiry, setExpiry] = useState<ExpiryChoice>('30');
  const [date, setDate] = useState('');
  const [permissions, setPermissions] = useState({ read: true, write: false, delete: false });
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<CreatedAgentKey | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copyError, setCopyError] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<AgentKey | null>(null);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState(false);
  const [showOAuth, setShowOAuth] = useState(false);
  const [now, setNow] = useState(() => new Date());
  const generation = useRef(0);
  const mutation = useRef(false);
  const nameRef = useRef<HTMLInputElement>(null);
  const secretRef = useRef<HTMLInputElement>(null);
  const refreshRef = useRef<HTMLButtonElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const endpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mcp-server/mcp`;
  const apiEndpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/agent-api/api/v1`;
  const formatTime = (value: string) => new Date(value).toLocaleString(lang === 'zh' ? 'zh-CN' : 'en-GB', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
  const expiryText = (key: AgentKey) => key.revoked_at ? `${t('撤销于', 'Revoked')} ${formatTime(key.revoked_at)} ${t('（北京时间）', '(UTC+8)')}` : key.expires_at ? `${t('有效至', 'Expires')} ${formatTime(key.expires_at)} ${t('（北京时间）', '(UTC+8)')}` : t('永久有效 · 可随时撤销', 'Never expires · revoke anytime');
  const statusText = (key: AgentKey) => ({ unused: t('尚未使用', 'Not used yet'), active: t('已使用', 'In use'), expired: t('已过期', 'Expired'), revoked: t('已撤销', 'Revoked') })[agentKeyStatus(key, now)];
  const permissionText = (key: AgentKey) => [key.read_enabled && t('读取', 'Read'), key.write_enabled && t('新增 / 修改', 'Create / edit'), key.delete_enabled && t('删除', 'Delete')].filter(Boolean).join(' · ');

  const load = useCallback(async () => {
    if (!userId || isDemo) return;
    const id = ++generation.current;
    setRefreshing(true); setListError(false);
    try {
      const result = await listAgentKeys(userId);
      if (generation.current === id) { setKeys(result); setLoaded(true); setNow(new Date()); }
    } catch { if (generation.current === id) setListError(true); }
    finally { if (generation.current === id) setRefreshing(false); }
  }, [userId, isDemo]);
  useEffect(() => {
    const pending = generation;
    setKeys([]); setLoaded(false); setCreated(null); setNotice(null); void load();
    return () => { pending.current++; };
  }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => { if (created) secretRef.current?.focus(); }, [created]);
  useEffect(() => {
    if (window.location.hash === '#agent-connections') sectionRef.current?.scrollIntoView({ block: 'start' });
  }, []);

  const copy = async (text: string, message: string) => {
    setCopyError(false); setNotice(null);
    try { await navigator.clipboard.writeText(text); setNotice(message); }
    catch { setCopyError(true); }
  };
  const create = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!userId || isDemo || mutation.current) return;
    setFormError(null); setNotice(null); setCopyError(false);
    if (!name.trim()) { setFormError(t('给这个连接起个名字，方便日后管理。', 'Name this connection so you can find it later.')); nameRef.current?.focus(); return; }
    if (!Object.values(permissions).some(Boolean)) { setFormError(t('至少选择一项权限。', 'Choose at least one permission.')); return; }
    let expiresAt: string | null;
    try { expiresAt = agentKeyExpiry(expiry, date); }
    catch { setFormError(t('请选择今天或之后的有效日期。', 'Choose today or a future expiration date.')); return; }
    mutation.current = true; setCreating(true);
    const id = ++generation.current;
    try {
      const result = await createAgentKey({ name: name.trim(), expiresAt, ...permissions });
      if (generation.current !== id) return;
      setCreated(result);
      const { api_key: _secret, ...metadata } = result;
      setKeys(all => [metadata, ...all.filter(key => key.client_id !== result.client_id)]);
      setName(''); setLoaded(true); setListError(false); setRefreshing(false);
      void load();
    } catch {
      if (generation.current === id) {
        setFormError(t('未收到生成结果，输入已保留。请刷新下方列表；若出现新 Key 却未拿到口令，可撤销后重新生成。', 'No creation result received. Your input is preserved. Refresh the list; revoke any new key whose secret was not received, then create another.'));
        setRefreshing(false);
      }
    } finally { mutation.current = false; setCreating(false); }
  };
  const revoke = async (key: AgentKey) => {
    if (!userId || isDemo || mutation.current) return;
    mutation.current = true; setRevoking(key.client_id); setRevokeError(false); setNotice(null);
    const id = ++generation.current;
    try {
      await revokeAgentKey(key.client_id);
      if (generation.current !== id) return;
      setKeys(all => all.map(item => item.client_id === key.client_id ? { ...item, revoked_at: new Date().toISOString(), read_enabled: false, write_enabled: false, delete_enabled: false } : item));
      if (created?.client_id === key.client_id) setCreated(null);
      setNotice(t('Key 已撤销，这个连接已停止访问。', 'Key revoked. This connection can no longer access your data.'));
      void load();
    } catch { if (generation.current === id) setRevokeError(true); }
    finally { mutation.current = false; setRevoking(null); setRefreshing(false); requestAnimationFrame(() => refreshRef.current?.focus()); }
  };
  const prompt = created ? `${t('请连接我的 V-Life：', 'Connect to my V-Life:')}\nMCP: ${endpoint}\nAPI: ${apiEndpoint}\nAuthorization: Bearer ${created.api_key}\n${t('直接使用以上 Bearer API Key，不要发起 OAuth 或设置回调地址。MCP 首次连接调用 agent_help；HTTP API 先 GET /guide。不要把 Key 写入代码仓库或日志。', 'Use this Bearer API Key directly, without OAuth or callback setup. Start MCP with agent_help, or HTTP API with GET /guide. Keep the key out of repositories and logs.')}` : '';

  if (!userId || isDemo) return <section ref={sectionRef} id="agent-connections" className="scroll-mt-24" aria-label={t('Agent 连接', 'Agent connections')}>
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><KeyRound className="h-5 w-5" aria-hidden="true" />{t('Agent 连接', 'Agent connections')}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{isDemo ? t('演示模式不创建真实连接。退出演示后，可以为自己的账户生成 API Key。', 'Demo mode does not create real connections. Leave the demo to create an API Key for your account.') : t('登录后即可生成 API Key，连接你的 Agent。', 'Sign in to create an API Key and connect your Agent.')}</p>
        {isDemo ? <Button type="button" onClick={exitDemo}>{t('退出演示，管理连接', 'Leave demo to manage connections')}</Button> : <Button asChild><a href="/auth">{t('登录后连接', 'Sign in to connect')}</a></Button>}
      </CardContent>
    </Card>
  </section>;

  return <section ref={sectionRef} id="agent-connections" className="scroll-mt-24 space-y-4" aria-label={t('Agent 连接', 'Agent connections')}>
    <Card>
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base"><KeyRound className="h-5 w-5" aria-hidden="true" />{t('Agent 连接', 'Agent connections')}</CardTitle>
        <p className="text-sm leading-relaxed text-muted-foreground">{t('生成一个 API Key，复制给你的 Agent 即可连接。', 'Create an API Key and copy it to your Agent to connect.')}</p>
      </CardHeader>
      <CardContent className="space-y-6">
        {created ? <div className="space-y-4 rounded-lg border border-cat-green/30 bg-cat-green-bg p-4" aria-labelledby="agent-key-ready">
          <div className="flex gap-2"><Check className="mt-0.5 h-5 w-5 shrink-0 text-cat-green" aria-hidden="true" /><div><h3 id="agent-key-ready" className="font-medium">{t('Key 已生成，复制后就能接入', 'Key created. Copy it to connect')}</h3><p className="mt-1 text-sm text-muted-foreground">{t('完整 Key 只在这里显示一次，请先保存。', 'The full key is shown only once. Save it before closing.')}</p></div></div>
          <div className="space-y-2"><Label htmlFor="agent-new-key">{t('新 API Key', 'New API Key')}</Label><Input ref={secretRef} id="agent-new-key" readOnly value={created.api_key} className="font-mono" onFocus={event => event.target.select()} /></div>
          <p className="text-sm">{created.client_name} · {expiryText(created)}</p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" onClick={() => void copy(created.api_key, t('API Key 已复制。', 'API Key copied.'))}><Copy className="mr-2 h-4 w-4" />{t('复制 API Key', 'Copy API Key')}</Button>
            <Button type="button" variant="outline" onClick={() => void copy(prompt, t('连接说明已复制，可粘贴给 Agent。', 'Connection instructions copied. Paste them to your Agent.'))}>{t('复制给 Agent', 'Copy for Agent')}</Button>
            <Button type="button" variant="outline" onClick={() => void copy(agentConnectionConfig(endpoint, created.api_key), t('MCP 配置已复制。', 'MCP configuration copied.'))}>{t('复制 MCP 配置', 'Copy MCP config')}</Button>
          </div>
          <Button type="button" variant="ghost" onClick={() => { setCreated(null); setNotice(null); setCopyError(false); requestAnimationFrame(() => nameRef.current?.focus()); }}>{t('我已保存，收起 Key', 'Saved. Hide this key')}</Button>
        </div> : <form onSubmit={create} className="space-y-4">
          <fieldset disabled={creating || !!revoking} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2"><Label htmlFor="agent-key-name">{t('连接名称', 'Connection name')}</Label><Input ref={nameRef} id="agent-key-name" value={name} onChange={e => setName(e.target.value)} placeholder={t('例如：Hermes、我的电脑', 'e.g. Hermes, my laptop')} maxLength={80} autoComplete="off" /></div>
              <div className="space-y-2"><Label htmlFor="agent-key-expiry">{t('有效期', 'Expires after')}</Label><select id="agent-key-expiry" value={expiry} onChange={e => setExpiry(e.target.value as ExpiryChoice)} className="flex min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:text-sm"><option value="30">{t('30 天', '30 days')}</option><option value="90">{t('90 天', '90 days')}</option><option value="custom">{t('指定日期', 'Choose a date')}</option><option value="never">{t('永久有效', 'Never expires')}</option></select></div>
            </div>
            {expiry === 'custom' && <div className="space-y-2"><DateField label={t('失效日期', 'Expiration date')} value={date} onChange={setDate} min={new Date(Date.now() + 8 * 3600000).toISOString().slice(0, 10)} /><p className="text-xs text-muted-foreground">{t('所选日期当天仍可使用，次日 00:00（北京时间）失效。', 'Valid through the selected date; expires at 00:00 the next day (UTC+8).')}</p></div>}
            <fieldset><legend className="mb-2 text-sm font-medium">{t('允许的操作', 'Allowed actions')}</legend><div className="flex flex-wrap gap-x-6 gap-y-2">{([
              ['read', t('读取数据', 'Read data')], ['write', t('新增和修改', 'Create and edit')], ['delete', t('删除数据', 'Delete data')],
            ] as const).map(([key, label]) => <label key={key} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm"><Checkbox checked={permissions[key]} onCheckedChange={checked => setPermissions(p => ({ ...p, [key]: checked === true }))} />{label}</label>)}</div></fieldset>
            <p className="flex gap-2 text-xs leading-relaxed text-muted-foreground"><ShieldCheck className="h-4 w-4 shrink-0" aria-hidden="true" />{t('只访问你的生活数据，模型密钥等私密设置不会开放。', 'Access is limited to your life data. Model keys and other private settings stay hidden.')}</p>
            {formError && <p role="alert" className="text-sm leading-relaxed text-destructive">{formError}</p>}
            <Button type="submit">{creating ? t('正在生成…', 'Creating…') : t('生成 API Key', 'Create API Key')}</Button>
          </fieldset>
        </form>}
        {copyError && <p role="alert" className="text-sm text-destructive">{t('复制失败，请选中 Key 或下方地址手动复制。', 'Copy failed. Select the key or address below and copy it manually.')}</p>}
        {notice && <p role="status" className="text-sm text-cat-green">{notice}</p>}

        <div className="space-y-3 border-t pt-5">
          <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-semibold">{t('我的 API Key', 'My API Keys')}</h3><Button ref={refreshRef} type="button" variant="ghost" disabled={refreshing || creating || !!revoking} onClick={() => void load()}><RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? 'animate-spin motion-reduce:animate-none' : ''}`} aria-hidden="true" />{refreshing ? t('正在刷新…', 'Refreshing…') : t('刷新状态', 'Refresh status')}</Button></div>
          {listError && <p role="alert" className="text-sm text-destructive">{t('连接列表暂时无法读取，请重试刷新。已有内容保留。', 'Could not refresh your connections. Existing results are preserved. Try again.')}</p>}
          {revokeError && <p role="alert" className="text-sm text-destructive">{t('未能确认撤销结果，请刷新状态后重试。', 'Could not confirm revocation. Refresh the status and retry.')}</p>}
          {!loaded && !listError && <p className="text-sm text-muted-foreground">{t('正在读取连接…', 'Loading connections…')}</p>}
          {loaded && !listError && keys.length === 0 && <p className="py-2 text-sm text-muted-foreground">{t('还没有 API Key。生成一个，连接你的第一个 Agent。', 'No API Keys yet. Create one to connect your first Agent.')}</p>}
          <ul className="divide-y">{keys.map(key => {
            const status = agentKeyStatus(key, now);
            return <li key={key.client_id} className="flex flex-col gap-3 py-4 first:pt-0 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 space-y-1"><div className="flex flex-wrap items-center gap-x-3 gap-y-1"><span className="break-all text-sm font-medium">{key.client_name}</span><span className={`text-xs ${status === 'expired' || status === 'revoked' ? 'text-muted-foreground' : 'text-cat-green'}`}>{statusText(key)}</span></div><p className="break-words text-xs text-muted-foreground"><span className="font-mono">{key.key_prefix}…</span>{permissionText(key) && ` · ${permissionText(key)}`}</p><p className="text-xs text-muted-foreground">{expiryText(key)}</p>{key.last_used_at && <p className="text-xs text-muted-foreground">{t('最近使用：', 'Last used: ')}{formatTime(key.last_used_at)} {t('（北京时间）', '(UTC+8)')}</p>}</div>
              {status !== 'revoked' && <Button type="button" variant="outline" className="self-start sm:shrink-0 sm:self-center" disabled={creating || !!revoking} aria-label={`${t('撤销', 'Revoke')} ${key.client_name}`} onClick={() => setRevokeTarget(key)}>{revoking === key.client_id ? t('正在撤销…', 'Revoking…') : t('撤销', 'Revoke')}</Button>}
            </li>;
          })}</ul>
          <p className="text-xs leading-relaxed text-muted-foreground">{t('粘贴 Key 后，让 Agent 读取一次使用指南，再刷新这里查看最近使用时间。', 'After pasting your key, ask the Agent to read the guide, then refresh to see its last use.')}</p>
        </div>
        <details className="group border-t pt-4"><summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-2 text-sm font-medium">{t('手动配置 · 连接地址', 'Manual setup · connection addresses')}<ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180 motion-reduce:transition-none" /></summary><div className="space-y-4 pt-3">{[[t('MCP 地址', 'MCP URL'), endpoint], [t('HTTP API 地址', 'HTTP API URL'), apiEndpoint]].map(([label, value]) => <div key={label} className="space-y-2"><p className="text-xs font-medium">{label}</p><code className="block break-all rounded-md bg-muted p-3 text-xs leading-relaxed">{value}</code><Button type="button" variant="outline" onClick={() => void copy(value, t('连接地址已复制。', 'Connection URL copied.'))}>{t('复制', 'Copy')} {label}</Button></div>)}<p className="text-xs leading-relaxed text-muted-foreground">{t('认证选择 API Key / Bearer Token，填入生成的 Key。如果客户端只支持自定义请求头，设置 Authorization: Bearer 你的Key。', 'Choose API Key / Bearer Token authentication and paste your key. For custom headers, use Authorization: Bearer YOUR_KEY.')}</p></div></details>
      </CardContent>
    </Card>
    <div><Button type="button" variant="ghost" aria-expanded={showOAuth} aria-controls="agent-oauth-connections" onClick={() => setShowOAuth(open => !open)}>{t('其他连接方式 · OAuth', 'Other connection methods · OAuth')}<ChevronDown className={`ml-2 h-4 w-4 transition-transform motion-reduce:transition-none ${showOAuth ? 'rotate-180' : ''}`} /></Button>{showOAuth && <div id="agent-oauth-connections" className="mt-3"><AgentOAuthConnections /></div>}</div>
    <AlertDialog open={!!revokeTarget} onOpenChange={open => { if (!open) setRevokeTarget(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{t('撤销这个 Key？', 'Revoke this key?')}</AlertDialogTitle><AlertDialogDescription>{t(`「${revokeTarget?.client_name ?? ''}」将停止访问。这个 Key 无法恢复，需要重新生成才能再次连接。`, `“${revokeTarget?.client_name ?? ''}” will lose access. This key cannot be restored; create a new one to reconnect.`)}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>{t('保留 Key', 'Keep key')}</AlertDialogCancel><AlertDialogAction onClick={() => { if (revokeTarget) void revoke(revokeTarget); }}>{t('撤销 Key', 'Revoke key')}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </section>;
}
