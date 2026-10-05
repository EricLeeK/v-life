import { assertEquals, assertRejects } from 'jsr:@std/assert@1';
import { jwtVerify, generateKeyPair, exportJWK } from 'npm:jose@6';
import { authenticateApiKey, AgentAuthError, createKeyTokenProvider, type KeyIdentity } from '../_shared/agentKeyAuth.ts';

const key = `vlife_${'a'.repeat(64)}`;
const identity: KeyIdentity = { user_id: 'owner', client_id: 'key_id', read_enabled: true, write_enabled: false, delete_enabled: false, expires_at: null, revoked_at: null };
const pair = await generateKeyPair('ES256', { extractable: true });
const jwk = { ...await exportJWK(pair.privateKey), kid: 'test-signing-key', alg: 'ES256' };
const dependencies = () => ({ resolve: async (_hash: string): Promise<KeyIdentity | null> => identity, signingJwk: JSON.stringify(jwk), issuer: 'https://example.test/auth/v1', now: () => new Date('2026-10-05T08:00:00Z') });

Deno.test('opaque API key becomes a short internal user token with the existing agent identity', async () => {
  let hashed = '';
  const deps = dependencies();
  deps.resolve = async hash => { hashed = hash; return identity; };
  const result = await authenticateApiKey(key, deps);
  assertEquals(hashed.length, 64);
  assertEquals(hashed === key, false);
  const { payload } = await jwtVerify(result.token, pair.publicKey, { currentDate: deps.now(), issuer: deps.issuer, audience: 'authenticated' });
  assertEquals(payload.sub, 'owner');
  assertEquals(payload.role, 'authenticated');
  assertEquals(payload.client_id, 'key_id');
  assertEquals(payload.agent_key_id, 'key_id');
  assertEquals(Number(payload.exp) - Number(payload.iat), 60);
});
Deno.test('invalid, expired, or revoked keys fail closed before any token is issued', async () => {
  for (const record of [null, { ...identity, revoked_at: '2026-10-05T07:00:00Z' }, { ...identity, expires_at: '2026-10-05T08:00:00Z' }]) {
    const deps = { ...dependencies(), resolve: async () => record };
    await assertRejects(() => authenticateApiKey(key, deps), AgentAuthError, 'API_KEY_INVALID');
  }
  let called = false;
  await assertRejects(() => authenticateApiKey('vlife_short', { ...dependencies(), resolve: async () => { called = true; return identity; } }), AgentAuthError);
  assertEquals(called, false);
});
Deno.test('does not cache grants across requests and caps internal expiry to key expiry', async () => {
  const deps = dependencies();
  deps.resolve = async () => ({ ...identity, expires_at: '2026-10-05T08:00:20Z' });
  const result = await authenticateApiKey(key, deps);
  const { payload } = await jwtVerify(result.token, pair.publicKey, { currentDate: deps.now() });
  assertEquals(Number(payload.exp) - Number(payload.iat), 20);
  deps.resolve = async () => null;
  await assertRejects(() => authenticateApiKey(key, deps), AgentAuthError);
});
Deno.test('configuration and database outages are service errors, never invalid-key errors', async () => {
  for (const deps of [{ ...dependencies(), signingJwk: undefined }, { ...dependencies(), resolve: async (): Promise<KeyIdentity | null> => { throw Error('database unavailable'); } }]) {
    try { await authenticateApiKey(key, deps); throw Error('accepted'); }
    catch (e) { assertEquals((e as AgentAuthError).status, 503); }
  }
});
Deno.test('long-running tools renew their internal token and recheck revocation', async () => {
  let seconds = 0;
  const deps = { ...dependencies(), now: () => new Date(Date.parse('2026-10-05T08:00:00Z') + seconds * 1000) };
  const initial = await authenticateApiKey(key, deps);
  const getToken = createKeyTokenProvider(key, deps, initial);
  assertEquals(await getToken(), initial.token);
  seconds = 70;
  const renewed = await getToken();
  const { payload } = await jwtVerify(renewed, pair.publicKey, { currentDate: deps.now() });
  assertEquals(Number(payload.iat), Math.floor(deps.now().getTime() / 1000));
  seconds = 140; deps.resolve = async () => null;
  await assertRejects(() => getToken(), AgentAuthError, 'API_KEY_INVALID');
});
Deno.test('accepts the standard CLI private JWK without an alg field but rejects a public key', async () => {
  const { alg: _alg, ...cliJwk } = jwk;
  const result = await authenticateApiKey(key, { ...dependencies(), signingJwk: JSON.stringify(cliJwk) });
  assertEquals(result.identity.user_id, identity.user_id);
  const { d: _private, ...publicJwk } = jwk;
  await assertRejects(() => authenticateApiKey(key, { ...dependencies(), signingJwk: JSON.stringify(publicJwk) }), AgentAuthError, 'API_KEY_AUTH_NOT_CONFIGURED');
});
Deno.test('accepts Supabase CLI JWK key_ops while importing only the private signing operation', async () => {
  const deps = dependencies();
  deps.signingJwk = JSON.stringify({ ...jwk, use: 'sig', key_ops: ['sign', 'verify'], ext: true });
  const result = await authenticateApiKey(key, deps);
  const { payload } = await jwtVerify(result.token, pair.publicKey, { currentDate: deps.now() });
  assertEquals(payload.sub, identity.user_id);
  assertEquals(Number(payload.exp) - Number(payload.iat), 60);
});
Deno.test('does not expand a JWK that explicitly excludes signing', async () => {
  await assertRejects(() => authenticateApiKey(key, { ...dependencies(), signingJwk: JSON.stringify({ ...jwk, key_ops: ['verify'] }) }), AgentAuthError, 'API_KEY_AUTH_NOT_CONFIGURED');
});
