import { webcrypto } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createNewspaperPaidRequestStore } from "./newspaperPaidRequests";

describe("paid newspaper request recovery", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.stubGlobal("crypto", webcrypto);
  });
  it("reuses the durable key after a transport failure and page reload", async () => {
    const input = {
      date: "2026-09-28",
      prompt: "private prompt text",
      section_id: "main",
    };
    const first = createNewspaperPaidRequestStore(sessionStorage);
    const firstInvoke = vi.fn().mockRejectedValue(new Error("connection lost"));
    await expect(first.run("user-a", "image_generate", input, firstInvoke))
      .rejects.toThrow("connection lost");
    const key = firstInvoke.mock.calls[0][0];
    const reloaded = createNewspaperPaidRequestStore(sessionStorage);
    const retry = vi.fn().mockResolvedValue({ id: "job-1", status: "running" });
    await reloaded.run("user-a", "image_generate", {
      section_id: "main",
      prompt: "private prompt text",
      date: "2026-09-28",
    }, retry);
    expect(retry).toHaveBeenCalledWith(key);
    expect(JSON.stringify(Object.values(sessionStorage))).not.toContain(
      "private prompt text",
    );
    expect(reloaded.pending("user-a", "image_generate", "2026-09-28")[0].status)
      .toBe("running");
  });
  it("retains unknown review identity through reload but permits a new intentional generation after success", async () => {
    const input = { date: "2026-09-28" };
    const store = createNewspaperPaidRequestStore(sessionStorage);
    const uncertain = Object.assign(new Error("unknown"), {
      code: "REVIEW_RESULT_UNCERTAIN",
    });
    const first = vi.fn().mockRejectedValue(uncertain);
    await expect(store.run("user-a", "review_generate", input, first)).rejects
      .toThrow();
    const reloaded = createNewspaperPaidRequestStore(sessionStorage);
    const replay = vi.fn().mockResolvedValue({
      date: input.date,
      review: { overview: "saved" },
    });
    await reloaded.run("user-a", "review_generate", input, replay);
    expect(replay.mock.calls[0][0]).toBe(first.mock.calls[0][0]);
    const newGeneration = vi.fn().mockResolvedValue({
      date: input.date,
      review: { overview: "new" },
    });
    await reloaded.run("user-a", "review_generate", input, newGeneration);
    expect(newGeneration.mock.calls[0][0]).not.toBe(first.mock.calls[0][0]);
  });
  it("isolates identities by account, demo, action, date and complete payload", async () => {
    const store = createNewspaperPaidRequestStore(sessionStorage);
    const invoke = vi.fn().mockResolvedValue({ status: "unknown" });
    for (
      const [scope, action, input] of [
        ["user-a", "image_generate", { date: "2026-09-28", prompt: "one" }],
        ["user-b", "image_generate", { date: "2026-09-28", prompt: "one" }],
        ["demo", "image_generate", { date: "2026-09-28", prompt: "one" }],
        ["user-a", "review_generate", { date: "2026-09-28", prompt: "one" }],
        ["user-a", "image_generate", { date: "2026-09-27", prompt: "one" }],
        ["user-a", "image_generate", { date: "2026-09-28", prompt: "two" }],
      ] as const
    ) await store.run(scope, action, input, invoke);
    expect(new Set(invoke.mock.calls.map(([key]) => key)).size).toBe(6);
  });
  it("releases an image request only when its own polled job is terminal", async () => {
    const store = createNewspaperPaidRequestStore(sessionStorage);
    const invoke = vi.fn().mockResolvedValue({
      id: "job-1",
      status: "running",
    });
    await store.run("user-a", "image_generate", { date: "2026-09-28" }, invoke);
    store.reconcileImages("user-a", "2026-09-28", [{
      id: "job-other",
      status: "succeeded",
    }]);
    expect(store.pending("user-a").length).toBe(1);
    store.reconcileImages("user-a", "2026-09-28", [{
      id: "job-1",
      status: "unknown",
    }]);
    expect(store.pending("user-a")[0].status).toBe("unknown");
    store.reconcileImages("user-a", "2026-09-28", [{
      id: "job-1",
      status: "failed",
    }]);
    expect(store.pending("user-a")).toEqual([]);
  });
  it.each(
    [
      ["image_generate", "MODEL_UNAVAILABLE"],
      ["image_generate", "IMAGE_KEY_REQUIRED"],
      ["image_generate", "INVALID_INPUT"],
      ["image_generate", "PERMISSION_DENIED"],
      ["review_generate", "AI_NOT_CONFIGURED"],
      ["review_generate", "HOSTED_NOT_PROVISIONED"],
      ["review_generate", "HOSTED_DISABLED"],
      ["review_generate", "HOSTED_RATE_LIMIT"],
      ["review_generate", "HOSTED_QUOTA_EXCEEDED"],
      ["review_generate", "REPORT_TOO_LARGE"],
    ] as const,
  )(
    "allows an intentional retry after a fresh %s request is rejected with %s",
    async (action, code) => {
      const input = { date: "2026-09-28" };
      const store = createNewspaperPaidRequestStore(sessionStorage);
      const rejected = vi.fn().mockRejectedValue(
        Object.assign(new Error(code), { code }),
      );
      await expect(store.run("user-a", action, input, rejected)).rejects
        .toThrow(code);
      expect(store.pending("user-a")).toEqual([]);
      const reloaded = createNewspaperPaidRequestStore(sessionStorage);
      const retry = vi.fn().mockResolvedValue({ status: "pending" });
      await reloaded.run("user-a", action, input, retry);
      expect(retry.mock.calls[0][0]).not.toBe(rejected.mock.calls[0][0]);
    },
  );
  it("preserves a possibly submitted request when a later replay cannot pass authentication", async () => {
    const input = { date: "2026-09-28" };
    const first = vi.fn().mockRejectedValue(new Error("connection lost"));
    await expect(
      createNewspaperPaidRequestStore(sessionStorage).run(
        "user-a",
        "image_generate",
        input,
        first,
      ),
    ).rejects.toThrow();
    const replay = vi.fn().mockRejectedValue(
      Object.assign(new Error("sign in again"), { code: "UNAUTHORIZED" }),
    );
    const reloaded = createNewspaperPaidRequestStore(sessionStorage);
    await expect(reloaded.run("user-a", "image_generate", input, replay))
      .rejects.toThrow();
    expect(reloaded.pending("user-a")[0].key).toBe(first.mock.calls[0][0]);
  });
  it("recovers the same main-image request when one caller omits the default section", async () => {
    const input = { date: "2026-09-28" };
    const first = vi.fn().mockRejectedValue(new Error("connection lost"));
    await expect(
      createNewspaperPaidRequestStore(sessionStorage).run(
        "user-a",
        "image_generate",
        input,
        first,
      ),
    ).rejects.toThrow();
    const retry = vi.fn().mockResolvedValue({ id: "job-1", status: "running" });
    await createNewspaperPaidRequestStore(sessionStorage).run(
      "user-a",
      "image_generate",
      { ...input, section_id: "main" },
      retry,
    );
    expect(retry.mock.calls[0][0]).toBe(first.mock.calls[0][0]);
  });
  it("allows an intentional new review when the completed result belongs to an older revision", async () => {
    const store = createNewspaperPaidRequestStore(sessionStorage);
    const input = { date: "2026-09-28" };
    const old = vi.fn().mockRejectedValue(Object.assign(new Error("revision changed"), { code: "REVIEW_STALE" }));
    await expect(store.run("user-a", "review_generate", input, old)).rejects.toThrow();
    expect(store.pending("user-a")).toEqual([]);
    const retry = vi.fn().mockResolvedValue({ review: { overview: "current revision" } });
    await store.run("user-a", "review_generate", input, retry);
    expect(retry.mock.calls[0][0]).not.toBe(old.mock.calls[0][0]);
  });
});
