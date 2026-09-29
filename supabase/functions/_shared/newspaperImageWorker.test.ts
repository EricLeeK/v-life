import { describe, expect, it, vi } from "vitest";
import { resizeNewspaperImage } from "./newspaperImageResize";
import { processNewspaperImageJobs } from "./newspaperImageWorker";
vi.mock("./newspaperImageResize.ts", () => ({ resizeNewspaperImage: vi.fn() }));
vi.stubGlobal("AbortSignal", { timeout: () => new AbortController().signal });

const baseJob = {
  id: "j",
  user_id: "u",
  report_date: "2026-09-28",
  section_id: "main",
  status: "queued",
  lease_token: "lease",
  attempts: 1,
  created_at: new Date().toISOString(),
  prompt: "day",
  options: {
    provider: "grsai",
    model: "gpt-image-2-vip",
    size: "auto",
    quality: "high",
    aspect_ratio: "auto",
  },
  reference_images: [],
  base_url: "https://grsai.dakka.com.cn",
  provider_job_id: null,
  provider_result: null,
};
function fixture(extra: any = {}) {
  let claimed = false;
  const calls: any[] = [];
  const job = { ...baseJob, ...extra };
  const rpc = vi.fn(async (name: string, args: any) => {
    calls.push({ name, args });
    if (name === "newspaper_image_claim") {
      if (claimed) return { data: [], error: null };
      claimed = true;
      return { data: [job], error: null };
    }
    return { data: true, error: null };
  });
  const db = {
    rpc,
    from: vi.fn(() => ({
      select: () => ({
        eq: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { api_key: "secret-key" },
              error: null,
            }),
          }),
        }),
      }),
    })),
    storage: {
      from: vi.fn(() => ({
        download: vi.fn(async () => ({
          data: null,
          error: { statusCode: "404", message: "Object not found" },
        })),
      })),
    },
  };
  return { db, calls };
}
describe("durable newspaper image worker", () => {
  it("marks a timed-out submission unknown and does not try another endpoint", async () => {
    const { db, calls } = fixture();
    const fetcher = vi.fn(async () => {
      throw new Error("timeout secret-key");
    });
    await processNewspaperImageJobs(db, { fetch: fetcher as any });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(
      calls.filter((x) => x.name === "newspaper_image_checkpoint").map((x) =>
        x.args.p_status
      ),
    ).toEqual(["submitting", "unknown"]);
    expect(JSON.stringify(calls)).not.toContain("secret-key");
  });
  it("never submits a saving job again even when saving fails", async () => {
    const { db, calls } = fixture({
      status: "saving",
      provider_result: { data: "not an image", mime: "image/png" },
    });
    const fetcher = vi.fn();
    await processNewspaperImageJobs(db, { fetch: fetcher });
    expect(fetcher).not.toHaveBeenCalled();
    expect(db.from).not.toHaveBeenCalled();
    expect(calls.at(-1)?.args.p_status).toBe("failed");
  });
  it("polls the persisted task id and persists output before storage", async () => {
    const { db, calls } = fixture({
      status: "running",
      provider_job_id: "existing/id",
    });
    const fetcher = vi.fn(async () =>
      new Response(
        JSON.stringify({
          status: "succeeded",
          results: [{ url: "https://127.0.0.1/x" }],
        }),
        { headers: { "content-type": "application/json" } },
      )
    );
    await processNewspaperImageJobs(db, { fetch: fetcher as any });
    expect(fetcher.mock.calls[0][0]).toBe(
      "https://grsai.dakka.com.cn/v1/api/result?id=existing%2Fid",
    );
    expect(
      calls.filter((x) => x.name === "newspaper_image_checkpoint").map((x) =>
        x.args.p_status
      ),
    ).toEqual(["saving", "failed"]);
  });
  it("resumes from a saved original without a supplier call and commits only after a separate thumbnail upload", async () => {
    const { db, calls } = fixture({
      status: "saving",
      provider_result: {
        stored: {
          path: "u/originals/j.png",
          width: 1024,
          height: 1024,
          bytes: 2000,
        },
      },
    });
    const png = new Uint8Array(24);
    png.set([137, 80, 78, 71, 13, 10, 26, 10]);
    new DataView(png.buffer).setUint32(16, 640);
    new DataView(png.buffer).setUint32(20, 640);
    vi.mocked(resizeNewspaperImage).mockResolvedValue(png);
    const bucket = {
      download: vi.fn(async () => ({
        data: { arrayBuffer: async () => new ArrayBuffer(100) },
        error: null,
      })),
      upload: vi.fn(async () => ({ error: null })),
    };
    db.storage.from.mockReturnValue(bucket);
    const fetcher = vi.fn();
    await processNewspaperImageJobs(db, { fetch: fetcher });
    expect(fetcher).not.toHaveBeenCalled();
    expect(db.from).not.toHaveBeenCalled();
    expect(bucket.upload.mock.calls[0][0]).toBe("u/thumbnails/j.png");
    expect(calls.at(-1)).toMatchObject({
      name: "newspaper_image_finish",
      args: {
        p_path: "u/originals/j.png",
        p_thumbnail: "u/thumbnails/j.png",
        p_width: 1024,
      },
    });
  });
  it.each(["database_error", "lease_lost"])(
    "recovers an uploaded original after %s even when the supplier URL expires",
    async (failure) => {
      const durable: any = {
        ...baseJob,
        status: "saving",
        provider_result: { url: "https://cdn.example.com/temporary.png" },
      };
      const original = new Uint8Array(2048);
      original.set([137, 80, 78, 71, 13, 10, 26, 10]);
      new DataView(original.buffer).setUint32(16, 1024);
      new DataView(original.buffer).setUint32(20, 1024);
      const thumb = original.slice(0, 24);
      new DataView(thumb.buffer).setUint32(16, 640);
      new DataView(thumb.buffer).setUint32(20, 640);
      vi.mocked(resizeNewspaperImage).mockResolvedValue(thumb);
      const objects = new Map<string, Uint8Array>();
      const bucket = {
        download: vi.fn(async (path: string) => {
          const bytes = objects.get(path);
          return bytes
            ? {
              data: {
                size: bytes.length,
                arrayBuffer: async () => bytes.slice().buffer,
              },
              error: null,
            }
            : {
              data: null,
              error: { statusCode: "404", message: "Object not found" },
            };
        }),
        upload: vi.fn(async (path: string, bytes: Uint8Array) => {
          objects.set(path, bytes.slice());
          return { error: null };
        }),
      };
      let failCheckpoint = true;
      const db = {
        from: vi.fn(),
        storage: { from: vi.fn(() => bucket) },
        rpc: vi.fn(async (name: string, args: any) => {
          if (name === "newspaper_image_claim") {
            return {
              data: [{
                ...durable,
                provider_result: structuredClone(durable.provider_result),
              }],
              error: null,
            };
          }
          if (name === "newspaper_image_checkpoint") {
            if (args.p_result?.stored && failCheckpoint) {
              failCheckpoint = false;
              return failure === "database_error"
                ? { data: null, error: { message: "database unavailable" } }
                : { data: false, error: null };
            }
            durable.status = args.p_status;
            if (args.p_result) durable.provider_result = args.p_result;
            return { data: true, error: null };
          }
          if (name === "newspaper_image_finish") {
            durable.status = "succeeded";
            return { data: { id: "asset" }, error: null };
          }
          throw new Error(name);
        }),
      };
      const fetcher = vi.fn(async () =>
        new Response(original, { headers: { "content-type": "image/png" } })
      );
      await processNewspaperImageJobs(db, {
        fetch: fetcher as any,
        resolveHost: async () => ["8.8.8.8"],
      });
      expect(objects.has("u/originals/j.png")).toBe(true);
      expect(durable.provider_result).toEqual({
        url: "https://cdn.example.com/temporary.png",
      });
      fetcher.mockResolvedValue(
        new Response("expired", {
          status: 410,
          headers: { "content-type": "text/plain" },
        }),
      );
      await processNewspaperImageJobs(db, {
        fetch: fetcher as any,
        resolveHost: async () => ["8.8.8.8"],
      });
      expect(durable.status).toBe("succeeded");
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(db.from).not.toHaveBeenCalled();
      expect(
        bucket.upload.mock.calls.filter(([path]) =>
          path.includes("/originals/")
        ),
      ).toHaveLength(1);
      expect(objects.has("u/thumbnails/j.png")).toBe(true);
      expect(
        bucket.download.mock.calls.every(([path]) =>
          /^u\/originals\/j\.(png|jpg|webp)$/.test(path)
        ),
      ).toBe(true);
      expect(
        db.rpc.mock.calls.filter(([name]) => name === "newspaper_image_finish"),
      ).toHaveLength(1);
    },
  );
  it("stops before submitting when the lease was lost", async () => {
    const { db } = fixture();
    db.rpc.mockImplementation(async (name: string) => ({
      data: name === "newspaper_image_claim" ? [baseJob] : false,
      error: null,
    }));
    const fetcher = vi.fn();
    await processNewspaperImageJobs(db, { fetch: fetcher });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
