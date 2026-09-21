import { describe, expect, it, vi } from "vitest";
import {
  assertBrowserMayManageAccess,
  assertAgentOperationAllowed,
  canonicalizePayload,
  hashIdempotencyPayload,
  mutateIdempotently,
} from "./agentAccess";

describe("agent access policy", () => {
  it("only permits browser sessions to manage grants", () => {
    expect(() => assertBrowserMayManageAccess(undefined)).not.toThrow();
    expect(() => assertBrowserMayManageAccess("client-1")).toThrow("BROWSER_SESSION_REQUIRED");
  });

  it("rejects operations without an enabled grant", () => {
    expect(() => assertAgentOperationAllowed({ read_enabled: true, write_enabled: false, delete_enabled: false }, "read")).not.toThrow();
    expect(() => assertAgentOperationAllowed({ read_enabled: true, write_enabled: false, delete_enabled: false }, "write")).toThrow("AGENT_ACCESS_DENIED");
  });

  it("canonicalizes payload keys before hashing", async () => {
    expect(canonicalizePayload({ b: 2, a: 1 })).toBe(canonicalizePayload({ a: 1, b: 2 }));
    expect(await hashIdempotencyPayload({ b: 2, a: 1 })).toBe(await hashIdempotencyPayload({ a: 1, b: 2 }));
  });

  it("delegates idempotency to one atomic RPC call", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: { status: "applied" }, error: null });
    const result = await mutateIdempotently({ rpc } as any, {
      module: "todo", operation: "create",
      id: null, payload: { title: "x" }, key: "k", requestId: "r", toolName: "create",
    });
    expect(result).toEqual({ status: "applied" });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0][0]).toBe("agent_mutate");
  });
});
