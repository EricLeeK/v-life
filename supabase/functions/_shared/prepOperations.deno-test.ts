import { executePrepOperation } from "./prepOperations.ts";
function assert(value: unknown) {
  if (!value) throw new Error("assertion failed");
}
Deno.test("prep rejects read-only writes before touching DB", async () => {
  try {
    await executePrepOperation(
      { permissions: { read: true, write: false } },
      "create",
      { entity: "exams", record: { name: "x" } },
    );
    throw new Error("allowed");
  } catch (e) {
    assert((e as Error).message.includes("权限"));
  }
});
Deno.test(
  "asset URL never signs another owners path even if DB row is forged",
  async () => {
    let signed = false;
    const db = {
      from: () => ({
        select: () => ({
          eq: () => ({
            single: async () => ({
              data: { storage_path: "other-user/secret.png" },
            }),
          }),
        }),
      }),
    };
    try {
      await executePrepOperation(
        {
          permissions: { read: true },
          userId: "owner",
          db,
          admin: {
            storage: {
              from: () => ({
                createSignedUrl: () => {
                  signed = true;
                },
              }),
            },
          },
        },
        "asset_url",
        { id: "x" },
      );
    } catch (e) {
      assert((e as Error).message.includes("账户"));
    }
    assert(!signed);
  },
);
Deno.test(
  "batch requires stable IDs and does not claim success for partial failures",
  async () => {
    let writes = 0;
    const db = {
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: null }) }),
        }),
        insert: () => {
          writes++;
          return {
            select: () => ({
              single: async () => ({ error: { message: "invalid record" } }),
            }),
          };
        },
      }),
    };
    const ctx = {
      permissions: { read: true, write: true },
      db,
      userId: "owner",
    };
    try {
      await executePrepOperation(ctx, "batch_create", {
        items: [{ entity: "exams", record: { name: "x" } }],
      });
    } catch {}
    assert(writes === 0);
    const result = await executePrepOperation(ctx, "batch_create", {
      items: [{ id: "stable", entity: "exams", record: { name: "x" } }],
    });
    assert(result.results[0].ok === false);
    assert(writes === 1);
  },
);
