import { importJWK, SignJWT } from 'npm:jose@6';

export type KeyIdentity = {
  user_id: string; client_id: string;
  read_enabled: boolean; write_enabled: boolean; delete_enabled: boolean;
  expires_at: string | null; revoked_at: string | null;
};
export class AgentAuthError extends Error {
  constructor(public code: string, public status: number) { super(code); }
}
type KeyAuthDependencies = {
  resolve: (hash: string) => Promise<KeyIdentity | null>;
  signingJwk: string | undefined; issuer: string; now?: () => Date;
};

/** Opaque keys never reach PostgREST, logs, URLs, or a user's browser session store. */
export async function authenticateApiKey(rawKey: string, deps: KeyAuthDependencies) {
  if (!/^vlife_[a-f0-9]{64}$/.test(rawKey)) throw new AgentAuthError('API_KEY_INVALID', 401);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawKey));
  const hash = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
  let identity: KeyIdentity | null;
  try { identity = await deps.resolve(hash); }
  catch { throw new AgentAuthError('AUTH_SERVICE_UNAVAILABLE', 503); }
  const now = Math.floor((deps.now?.() ?? new Date()).getTime() / 1000);
  const expires = identity?.expires_at ? Math.floor(Date.parse(identity.expires_at) / 1000) : now + 60;
  if (!identity || identity.revoked_at || !Number.isFinite(expires) || expires <= now) throw new AgentAuthError('API_KEY_INVALID', 401);
  if (!deps.signingJwk) throw new AgentAuthError('API_KEY_AUTH_NOT_CONFIGURED', 503);
  try {
    const jwk = JSON.parse(deps.signingJwk);
    if ((jwk.alg && jwk.alg !== 'ES256') || jwk.kty !== 'EC' || jwk.crv !== 'P-256' || !jwk.kid || !jwk.d) throw Error('Private ES256 signing JWK required');
    if (jwk.key_ops !== undefined && (!Array.isArray(jwk.key_ops) || !jwk.key_ops.includes('sign'))) throw Error('JWK must allow signing');
    // Supabase CLI exports both sign/verify usages. Web Crypto only permits
    // signing with an EC private key; narrow its usage at the import boundary.
    const signer = await importJWK({ ...jwk, key_ops: ['sign'] }, 'ES256');
    const token = await new SignJWT({ role: 'authenticated', client_id: identity.client_id, agent_key_id: identity.client_id })
      .setProtectedHeader({ alg: 'ES256', kid: jwk.kid, typ: 'JWT' })
      .setSubject(identity.user_id).setIssuer(deps.issuer).setAudience('authenticated')
      .setIssuedAt(now).setExpirationTime(Math.min(now + 60, expires)).sign(signer);
    return { identity, token, expiresAt: Math.min(now + 60, expires) * 1000 };
  } catch { throw new AgentAuthError('API_KEY_AUTH_NOT_CONFIGURED', 503); }
}

/** Per-request cache only. Slow image/report tools must not outlive a frozen JWT.
 * Renewals resolve the key again; RLS checks revocation on every database request.
 */
export function createKeyTokenProvider(rawKey: string, deps: KeyAuthDependencies, initial: Awaited<ReturnType<typeof authenticateApiKey>>) {
  let current = initial;
  let renewal: Promise<typeof initial> | null = null;
  return async () => {
    if ((deps.now?.() ?? new Date()).getTime() >= current.expiresAt - 10_000) {
      renewal ??= authenticateApiKey(rawKey, deps);
      try { current = await renewal; } finally { renewal = null; }
    }
    return current.token;
  };
}
