import { withOAuthProtectedResource, withSupabase } from 'npm:@supabase/server@1.6.0';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { AgentAuthError, authenticateApiKey, createKeyTokenProvider, type KeyIdentity } from './agentKeyAuth.ts';
import type { AgentContext } from './agentDataService.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
function denied(code: string, status: number) {
  const messages: Record<string, string> = {
    API_KEY_INVALID: 'API Key 无效、已过期或已撤销，请在 V-Life 设置中创建新的 Key。',
    API_KEY_AUTH_NOT_CONFIGURED: 'API Key 连接服务尚未配置完成，请联系站点管理员。',
    AUTH_SERVICE_UNAVAILABLE: '连接服务暂时不可用，请稍后使用同一 Key 重试。',
    AGENT_ACCESS_DENIED: '此连接未获得授权、已过期或已撤销。',
    OAUTH_TOKEN_REQUIRED: '请使用 V-Life API Key 或有效的 Agent OAuth Token。',
  };
  return Response.json({ ok: false, error: { code, message: messages[code] } }, {
    status, headers: { 'Cache-Control': 'no-store', ...(status === 401 ? { 'WWW-Authenticate': 'Bearer error="invalid_token"' } : {}) },
  });
}
function context(req: Request, db: AgentContext['db'], identity: KeyIdentity): AgentContext {
  return { db, userId: identity.user_id, clientId: identity.client_id,
    requestId: req.headers.get('X-Request-Id')?.slice(0, 200) || crypto.randomUUID(),
    idempotencyKey: req.headers.get('Idempotency-Key') ?? undefined,
    permissions: { read: identity.read_enabled === true, write: identity.write_enabled === true, delete: identity.delete_enabled === true } };
}

/** Both transports use the same authentication and scoped database client. */
export function withAgentAuth(resource: string, handler: (req: Request, ctx: AgentContext) => Promise<Response>) {
  const oauth = withOAuthProtectedResource({ resourceServer: resource, authorizationServer: `${supabaseUrl}/auth/v1` },
    withSupabase({ auth: 'user' }, async (req, auth) => {
      const claims = auth.jwtClaims;
      if (!claims?.sub || typeof claims.client_id !== 'string' || !claims.client_id) return denied('OAUTH_TOKEN_REQUIRED', 403);
      const db = auth.supabase as unknown as AgentContext['db'];
      const { data: grant, error } = await db.from('agent_client_access')
        .select('user_id,client_id,credential_type,read_enabled,write_enabled,delete_enabled,revoked_at,expires_at')
        .eq('user_id', claims.sub).eq('client_id', claims.client_id).maybeSingle();
      if (error) return denied('AUTH_SERVICE_UNAVAILABLE', 503);
      if (!grant || grant.credential_type !== 'oauth' || grant.revoked_at || (grant.expires_at && Date.parse(grant.expires_at) <= Date.now())) return denied('AGENT_ACCESS_DENIED', 403);
      return handler(req, context(req, db, grant));
    }));
  return async (req: Request): Promise<Response> => {
    const bearer = req.headers.get('Authorization')?.match(/^Bearer\s+(\S+)\s*$/i)?.[1];
    if (!bearer?.startsWith('vlife_')) return oauth(req);
    let ctx: AgentContext;
    try {
      const admin = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
      const keyAuth = {
        issuer: `${supabaseUrl}/auth/v1`, signingJwk: Deno.env.get('AGENT_JWT_SIGNING_JWK'),
        resolve: async (hash: string) => {
          const { data, error } = await admin.rpc('agent_resolve_api_key', { p_key_hash: hash });
          if (error) throw error;
          return data as KeyIdentity | null;
        },
      };
      const authenticated = await authenticateApiKey(bearer, keyAuth);
      // The service-role client is never passed to domain operations. The private
      // short token uses the original RLS / domain RPC boundary for every module.
      const db = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!, {
        accessToken: createKeyTokenProvider(bearer, keyAuth, authenticated), auth: { persistSession: false, autoRefreshToken: false },
      });
      ctx = context(req, db, authenticated.identity);
    } catch (error) {
      const failure = error instanceof AgentAuthError ? error : new AgentAuthError('AUTH_SERVICE_UNAVAILABLE', 503);
      return denied(failure.code, failure.status);
    }
    return handler(req, ctx);
  };
}
