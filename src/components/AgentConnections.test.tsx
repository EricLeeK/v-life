import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentConnections } from './AgentConnections';

const mocks = vi.hoisted(() => ({ list: vi.fn(), create: vi.fn(), revoke: vi.fn(), copy: vi.fn(), user: { id: 'owner' } as { id: string } | null, isDemo: false, exitDemo: vi.fn() }));
vi.mock('@/lib/agentKeyStore', () => ({ listAgentKeys: mocks.list, createAgentKey: mocks.create, revokeAgentKey: mocks.revoke }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: mocks.user }) }));
vi.mock('@/contexts/DemoModeContext', () => ({ useDemoMode: () => ({ isDemo: mocks.isDemo, exitDemo: mocks.exitDemo }) }));
vi.mock('./AgentOAuthConnections', () => ({ AgentOAuthConnections: () => <p>OAuth 暂不可用</p> }));
const record = { user_id: 'owner', client_id: 'key_1', client_name: 'Hermes', credential_type: 'api_key' as const, key_prefix: 'vlife_12345678', read_enabled: true, write_enabled: false, delete_enabled: false, expires_at: null, revoked_at: null, created_at: '2026-10-05T08:00:00Z', last_used_at: null };
beforeEach(() => {
  vi.clearAllMocks(); mocks.list.mockResolvedValue([]); mocks.create.mockResolvedValue({ ...record, api_key: 'vlife_secret' }); mocks.revoke.mockResolvedValue(undefined);
  mocks.user = { id: 'owner' }; mocks.isDemo = false;
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: mocks.copy.mockResolvedValue(undefined) } });
});
describe('API key connection journey', () => {
  it('keeps real connections out of demo mode even when a user is signed in', () => {
    mocks.isDemo = true;
    render(<AgentConnections />);
    expect(screen.queryByRole('button', { name: '生成 API Key' })).not.toBeInTheDocument();
    expect(mocks.list).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '退出演示，管理连接' }));
    expect(mocks.exitDemo).toHaveBeenCalledOnce();
  });
  it('offers sign-in instead of a nonfunctional form when signed out', () => {
    mocks.user = null;
    render(<AgentConnections />);
    expect(screen.getByRole('link', { name: '登录后连接' })).toHaveAttribute('href', '/auth');
    expect(mocks.list).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: '生成 API Key' })).not.toBeInTheDocument();
  });
  it('creates a permanent key, copies its config, and clears the one-time secret', async () => {
    render(<AgentConnections />);
    fireEvent.change(screen.getByLabelText('连接名称'), { target: { value: 'Hermes' } });
    fireEvent.change(screen.getByLabelText('有效期'), { target: { value: 'never' } });
    fireEvent.click(screen.getByRole('button', { name: '生成 API Key' }));
    await screen.findByLabelText('新 API Key');
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Hermes', expiresAt: null, read: true, write: false, delete: false }));
    fireEvent.click(screen.getByRole('button', { name: '复制 MCP 配置' }));
    await waitFor(() => expect(mocks.copy).toHaveBeenCalledWith(expect.stringContaining('Bearer vlife_secret')));
    fireEvent.click(screen.getByRole('button', { name: '我已保存，收起 Key' }));
    expect(screen.queryByLabelText('新 API Key')).not.toBeInTheDocument();
    expect(localStorage.getItem('vlife_secret')).toBeNull();
  });
  it('keeps input on creation failure and does not claim success', async () => {
    mocks.create.mockRejectedValue(Error('offline'));
    render(<AgentConnections />);
    fireEvent.change(screen.getByLabelText('连接名称'), { target: { value: 'My Agent' } });
    fireEvent.click(screen.getByRole('button', { name: '生成 API Key' }));
    await screen.findByRole('alert');
    expect(screen.getByLabelText('连接名称')).toHaveValue('My Agent');
    expect(screen.queryByLabelText('新 API Key')).not.toBeInTheDocument();
  });
  it('does not turn a refresh failure into an empty list', async () => {
    mocks.list.mockResolvedValueOnce([record]).mockRejectedValue(Error('offline'));
    render(<AgentConnections />);
    await screen.findByText('Hermes');
    fireEvent.click(screen.getByRole('button', { name: '刷新状态' }));
    await screen.findByRole('alert');
    expect(screen.getByText('Hermes')).toBeInTheDocument();
    expect(screen.queryByText('还没有 API Key。生成一个，连接你的第一个 Agent。')).not.toBeInTheDocument();
  });
  it('requires confirmation for irreversible revocation and keeps the key active on failure', async () => {
    mocks.list.mockResolvedValue([record]); mocks.revoke.mockRejectedValue(Error('offline'));
    render(<AgentConnections />);
    fireEvent.click(await screen.findByRole('button', { name: '撤销 Hermes' }));
    expect(mocks.revoke).not.toHaveBeenCalled();
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: '撤销 Key' }));
    await screen.findByRole('alert');
    expect(screen.getByText('尚未使用')).toBeInTheDocument();
  });
  it('loads OAuth only when requested and its failure cannot hide API keys', async () => {
    mocks.list.mockResolvedValue([record]); render(<AgentConnections />);
    await screen.findByText('Hermes');
    expect(screen.queryByText('OAuth 暂不可用')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('其他连接方式 · OAuth'));
    expect(await screen.findByText('OAuth 暂不可用')).toBeInTheDocument();
    expect(screen.getByText('Hermes')).toBeInTheDocument();
  });
});
