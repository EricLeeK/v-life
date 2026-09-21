import { describe, it } from "https://deno.land/std@0.224.0/testing/bdd.ts";
import { expect } from "https://deno.land/std@0.224.0/expect/mod.ts";
import { buildCapabilities, oauthChallenge } from "./mcpAdapter.ts";
describe("MCP adapter", () => { it("publishes allowlisted capabilities", () => { const caps = buildCapabilities(); expect(caps.modules.length).toBeGreaterThan(0); expect(JSON.stringify(caps)).not.toContain("api_key"); }); it("returns OAuth challenge", () => { const r = oauthChallenge("https://example/mcp"); expect(r.status).toBe(401); expect(r.headers.get("WWW-Authenticate")).toContain("Bearer"); }); });
