import { describe, expect, it } from 'vitest';
import { agentKeyExpiry, agentKeyStatus, agentConnectionConfig } from './agentKeys';

describe('API key connection setup', () => {
  const now = new Date('2026-10-05T08:00:00Z');
  it('supports permanent, duration, and inclusive China calendar dates', () => {
    expect(agentKeyExpiry('never', '', now)).toBeNull();
    expect(agentKeyExpiry('30', '', now)).toBe('2026-11-04T08:00:00.000Z');
    expect(agentKeyExpiry('custom', '2026-10-05', now)).toBe('2026-10-05T16:00:00.000Z');
  });
  it('rejects missing, invalid, and past custom dates instead of issuing a permanent key', () => {
    for (const date of ['', '2026-02-30', '2026-10-04', 'garbage']) {
      expect(() => agentKeyExpiry('custom', date, now)).toThrow();
    }
  });
  it('treats expiry boundary as expired and revocation takes precedence', () => {
    expect(agentKeyStatus({ revoked_at: null, expires_at: null, last_used_at: null }, now)).toBe('unused');
    expect(agentKeyStatus({ revoked_at: null, expires_at: null, last_used_at: now.toISOString() }, now)).toBe('active');
    expect(agentKeyStatus({ revoked_at: null, expires_at: now.toISOString() }, now)).toBe('expired');
    expect(agentKeyStatus({ revoked_at: now.toISOString(), expires_at: null }, now)).toBe('revoked');
  });
  it('places the key only in Authorization, never in a URL or OAuth callback', () => {
    const config = JSON.parse(agentConnectionConfig('https://example.test/mcp', 'vlife_test'));
    expect(config.mcpServers['v-life']).toEqual({ url: 'https://example.test/mcp', headers: { Authorization: 'Bearer vlife_test' } });
  });
});
