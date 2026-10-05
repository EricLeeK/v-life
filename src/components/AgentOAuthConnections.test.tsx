import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AgentOAuthConnections } from "./AgentOAuthConnections";

const USER_ID = "user-1";
const api = vi.hoisted(() => ({
  user: { id: "user-1" },
  listGrants: vi.fn(),
  revokeGrant: vi.fn(),
  from: vi.fn(),
  deletes: [] as { userId: string; clientId: string }[],
  upserts: [] as { client_id: string }[],
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: api.from, auth: { oauth: { listGrants: api.listGrants, revokeGrant: api.revokeGrant } } },
}));
vi.mock("@/contexts/AuthContext", () => ({
  useAuth: () => ({ user: api.user }),
}));

type AccessRow = {
  user_id: string;
  client_id: string;
  client_name: string;
  read_enabled: boolean;
  write_enabled: boolean;
  delete_enabled: boolean;
  revoked_at: string | null;
  last_used_at: string | null;
};

const revoked: AccessRow = {
  user_id: USER_ID, client_id: "revoked-client", client_name: "已撤销助手",
  read_enabled: false, write_enabled: false, delete_enabled: false, revoked_at: "2026-09-01T00:00:00Z", last_used_at: null,
};
const active: AccessRow = {
  user_id: USER_ID, client_id: "active-client", client_name: "仍在使用",
  read_enabled: true, write_enabled: false, delete_enabled: false, revoked_at: null, last_used_at: null,
};
const stuck: AccessRow = {
  user_id: USER_ID, client_id: "stuck-client", client_name: "授权未撤完",
  read_enabled: false, write_enabled: false, delete_enabled: false, revoked_at: "2026-09-02T00:00:00Z", last_used_at: null,
};

let rows: AccessRow[];
let deleteError: Error | null;

function rowOf(name: string) {
  const title = screen.getByText(name);
  const row = title.closest("div.border");
  if (!row) throw new Error(`missing row for ${name}`);
  return within(row as HTMLElement);
}

beforeEach(() => {
  vi.clearAllMocks();
  rows = [revoked, active, stuck];
  deleteError = null;
  api.deletes = [];
  api.upserts = [];
  api.listGrants.mockResolvedValue({
    data: [
      { client: { client_id: "active-client", name: "仍在使用" } },
      { client: { client_id: "stuck-client", name: "授权未撤完" } },
      { client: { client_id: "oauth-only", name: "仅 OAuth" } },
    ],
    error: null,
  });
  api.revokeGrant.mockResolvedValue({ error: null });
  api.from.mockImplementation((table: string) => {
    if (table !== "agent_client_access") throw new Error(`unexpected table ${table}`);
    return {
      select: () => ({ eq: (column: string, userId: string) => {
        expect([column, userId]).toEqual(["user_id", USER_ID]);
        return { eq: async (typeColumn: string, credentialType: string) => {
          expect([typeColumn, credentialType]).toEqual(["credential_type", "oauth"]);
          return { data: rows, error: null };
        } };
      } }),
      upsert: async (row: { client_id: string }) => { api.upserts.push(row); return { error: null }; },
      delete: () => ({
        eq: (_column: string, userId: string) => ({
          eq: async (_column2: string, clientId: string) => {
            api.deletes.push({ userId, clientId });
            if (deleteError) return { error: deleteError };
            rows = rows.filter((row) => row.client_id !== clientId);
            return { error: null };
          },
        }),
      }),
    };
  });
});
afterEach(cleanup);

describe("AgentOAuthConnections removal", () => {
  it("removes a revoked row that has no OAuth grant and leaves granted rows on revoke", async () => {
    render(<AgentOAuthConnections />);
    await waitFor(() => expect(rowOf("已撤销助手").getByRole("button", { name: "移除" })).toBeEnabled());
    expect(rowOf("已撤销助手").getByText("数据访问已禁止")).toBeInTheDocument();
    expect(rowOf("仍在使用").getByRole("button", { name: "撤销连接" })).toBeEnabled();
    expect(rowOf("仅 OAuth").getByRole("button", { name: "撤销连接" })).toBeEnabled();
    expect(rowOf("授权未撤完").getByRole("button", { name: "重试撤销 OAuth" })).toBeEnabled();
    expect(rowOf("仍在使用").queryByRole("button", { name: "移除" })).not.toBeInTheDocument();
    expect(rowOf("仅 OAuth").queryByRole("button", { name: "移除" })).not.toBeInTheDocument();
    expect(rowOf("授权未撤完").queryByRole("button", { name: "移除" })).not.toBeInTheDocument();

    fireEvent.click(rowOf("已撤销助手").getByRole("button", { name: "移除" }));
    await waitFor(() => expect(screen.queryByText("已撤销助手")).not.toBeInTheDocument());
    expect(api.deletes).toEqual([{ userId: USER_ID, clientId: "revoked-client" }]);
    expect(api.revokeGrant).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("已从列表移除。");
    expect(screen.getByText("仍在使用")).toBeInTheDocument();
    expect(screen.getByText("授权未撤完")).toBeInTheDocument();
  });

  it("keeps the revoked row and shows an alert when delete fails", async () => {
    deleteError = new Error("权限不足");
    render(<AgentOAuthConnections />);
    await waitFor(() => expect(screen.getByRole("button", { name: "移除" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "移除" }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("未能移除连接：权限不足。请重试。"));
    expect(screen.getByText("已撤销助手")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    expect(api.deletes).toEqual([{ userId: USER_ID, clientId: "revoked-client" }]);
  });

  it("does not delete when revoking an active connection or retrying a remaining grant", async () => {
    render(<AgentOAuthConnections />);
    await waitFor(() => expect(rowOf("仍在使用").getByRole("button", { name: "撤销连接" })).toBeEnabled());
    fireEvent.click(rowOf("仍在使用").getByRole("button", { name: "撤销连接" }));
    await waitFor(() => expect(api.revokeGrant).toHaveBeenCalledWith({ clientId: "active-client" }));
    expect(api.deletes).toEqual([]);
    expect(api.upserts.map((row) => row.client_id)).toEqual(["active-client"]);

    await waitFor(() => expect(rowOf("授权未撤完").getByRole("button", { name: "重试撤销 OAuth" })).toBeEnabled());
    expect(rowOf("授权未撤完").queryByRole("button", { name: "移除" })).not.toBeInTheDocument();
    expect(rowOf("仅 OAuth").queryByRole("button", { name: "移除" })).not.toBeInTheDocument();
    fireEvent.click(rowOf("授权未撤完").getByRole("button", { name: "重试撤销 OAuth" }));
    await waitFor(() => expect(api.revokeGrant).toHaveBeenCalledWith({ clientId: "stuck-client" }));
    expect(api.deletes).toEqual([]);
    expect(rowOf("仅 OAuth").queryByRole("button", { name: "移除" })).not.toBeInTheDocument();
  });
});
