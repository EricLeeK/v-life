import { describe, expect, it, vi } from "vitest";
import {
  NEWSPAPER_IMAGE_MODELS,
  normalizeNewspaperImageOptions,
  renderNewspaperImagePrompt,
  composeNewspaperImagePrompt,
} from "./newspaperImageModels";
import {
  buildImageRequest,
  fetchImageBytes,
  parseImageResponse,
  validateProviderBaseUrl,
  validatePublicImageUrl,
} from "./newspaperImageProviders";
import {
  createNewspaperImageService,
  decorateNewspaperImages,
} from "./newspaperImageService";

const opts = (extra: any = {}) => normalizeNewspaperImageOptions(extra);
describe("newspaper image capabilities and provider protocols", () => {
  it('uses JPEG for the official Gemini Interactions image output', () => {
    expect(buildImageRequest(opts({provider:'gemini'}), 'test', 'key', [], 'job').body)
      .toMatchObject({background:false,response_format:{mime_type:'image/jpeg'}});
  });
  it('renders one shared prompt from original text without expanding variables in records', () => {
    const report:any={date:'2026-09-28',snapshot:{sections:[{id:'thoughts',title:'手记',items:[{title:'原话',body:'今天想到 {{content}}，保留原文。',status:'recorded'}]}]},supplements:[{body:'  生活补充  ',occurred_at:null}]};
    expect(composeNewspaperImagePrompt('{{date}} / {{section}} / {{content}}',report,'main'))
      .toContain('今天想到 {{content}}，保留原文。');
    expect(composeNewspaperImagePrompt('{{content}}',report,'thoughts')).toContain('  生活补充  ');
  });
  it("exposes exactly the 13 Grsai Studio image choices, never video or invented aliases", () => {
    expect(
      NEWSPAPER_IMAGE_MODELS.filter((x) => x.provider === "grsai").map((x) =>
        x.id
      ),
    ).toEqual([
      "nano-banana",
      "nano-banana-fast",
      "nano-banana-2",
      "nano-banana-2-cl",
      "nano-banana-2-4k-cl",
      "nano-banana-pro",
      "nano-banana-pro-cl",
      "nano-banana-pro-vip",
      "nano-banana-pro-4k-vip",
      "gpt-image-2",
      "gpt-image-2-vip",
      "gpt-image-2.5-flare",
      "gpt-image-2.5-sunburst",
    ]);
    expect(opts()).toEqual({
      provider: "grsai",
      model: "gpt-image-2-vip",
      size: "auto",
      quality: "high",
      aspect_ratio: "auto",
    });
  });
  it("keeps official and Grsai quality matrices distinct", () => {
    expect(() => opts({ model: "gpt-image-2.5-flare", quality: "max" }))
      .toThrow();
    expect(
      opts({ provider: "openai", model: "gpt-image-2.5-flare", quality: "max" })
        .quality,
    ).toBe("max");
    expect(() => opts({ model: "sora" })).toThrow();
    expect(() =>
      opts({ provider: "gemini", model: "gemini-3-pro-image", size: "512" })
    ).toThrow();
  });
  it("accepts official flexible resolution constraints without applying Grsai presets", () => {
    expect(opts({ provider: "openai", size: "1536x864" }).size).toBe(
      "1536x864",
    );
    expect(() => opts({ provider: "openai", size: "3841x2160" })).toThrow();
    expect(() => opts({ provider: "openai", size: "3840x3840" })).toThrow();
  });
  it("uses Grsai pixel aspectRatio without imageSize, and nano ratio plus imageSize", () => {
    const gpt = buildImageRequest(
      opts({ size: "3840x2160" }),
      "day",
      "key",
      [],
      "job",
    );
    expect(gpt.url).toBe("https://grsai.dakka.com.cn/v1/api/generate");
    expect(gpt.body).toMatchObject({
      model: "gpt-image-2-vip",
      prompt: "day",
      replyType: "json",
      aspectRatio: "3840x2160",
      quality: "high",
      images: [],
    });
    expect(gpt.body).not.toHaveProperty("imageSize");
    expect(
      buildImageRequest(
        opts({ model: "nano-banana-2", size: "4K", aspect_ratio: "16:9" }),
        "day",
        "key",
        [],
        "job",
      ).body,
    ).toMatchObject({ imageSize: "4K", aspectRatio: "16:9" });
  });
  it("uses official Responses background and Gemini Interactions response_format", () => {
    expect(
      buildImageRequest(
        opts({ provider: "openai", model: "gpt-image-2" }),
        "day",
        "key",
        [],
        "job",
      ).body,
    ).toMatchObject({
      model: "gpt-5.4-mini",
      background: true,
      tools: [{
        type: "image_generation",
        model: "gpt-image-2",
        quality: "high",
        size: "auto",
      }],
    });
    const gem = buildImageRequest(
      opts({
        provider: "gemini",
        model: "gemini-3.1-flash-image",
        size: "2K",
        quality: "auto",
        aspect_ratio: "16:9",
      }),
      "day",
      "key",
      [{ data: "eA==", mime: "image/png" }],
      "job",
    );
    expect(gem.headers["Api-Revision"]).toBe("2026-05-20");
    expect(gem.body).toMatchObject({
      background: false,
      response_format: {
        type: "image",
        mime_type: "image/jpeg",
        image_size: "2K",
        aspect_ratio: "16:9",
      },
      input: [{ type: "text", text: "day" }, {
        type: "image",
        data: "eA==",
        mime_type: "image/png",
      }],
    });
  });
  it("parses terminal failure, queued ids, and output image bytes without leaking provider text", () => {
    expect(
      parseImageResponse("grsai", {
        status: "violation",
        error: "secret body",
      }),
    ).toEqual({ state: "failed", error: "图片供应商拒绝了本次生成。" });
    expect(parseImageResponse("grsai", { status: "running", id: "abc" }))
      .toEqual({ state: "running", id: "abc" });
    expect(
      parseImageResponse("openai", {
        status: "completed",
        id: "r",
        output: [{ type: "image_generation_call", result: "abcd" }],
      }),
    ).toMatchObject({
      state: "succeeded",
      image: { data: "abcd", mime: "image/png" },
    });
    expect(
      parseImageResponse("gemini", {
        status: "completed",
        id: "i",
        output_image: { data: "abcd", mime_type: "image/png" },
      }),
    ).toMatchObject({ state: "succeeded", image: { data: "abcd" } });
    expect(() => parseImageResponse("grsai", { status: "running" })).toThrow();
  });
  it("substitutes prompt placeholders literally without evaluating content", () => {
    expect(
      renderNewspaperImagePrompt("{{date}} {{content}} {{section}}", {
        date: "2026-09-28",
        content: "$& {{date}}",
        section: "主图",
      }),
    ).toBe("2026-09-28 $& {{date}} 主图");
    expect(() =>
      renderNewspaperImagePrompt("{{secret}}", {
        date: "x",
        content: "x",
        section: "x",
      })
    ).toThrow();
  });
});
describe("image network boundary", () => {
  it("only permits pinned provider endpoints with no credential-bearing URL overrides", () => {
    for (
      const url of [
        "http://grsaiapi.com",
        "https://127.0.0.1",
        "https://api.openai.com.evil.test",
        "https://x:y@grsaiapi.com",
        "https://grsaiapi.com/path",
      ]
    ) expect(() => validateProviderBaseUrl("grsai", url)).toThrow();
    expect(validateProviderBaseUrl("grsai", "https://grsaiapi.com/")).toBe(
      "https://grsaiapi.com",
    );
  });
  it("rejects local, encoded and DNS-private image endpoints before fetch", async () => {
    for (
      const url of [
        "http://example.com/x",
        "https://127.1/x",
        "https://2130706433/x",
        "https://[::1]/x",
        "https://u:p@example.com/x",
        "https://localhost/x",
        "https://169.254.169.254/x",
      ]
    ) {
      await expect(validatePublicImageUrl(url, async () => ["8.8.8.8"])).rejects
        .toThrow();
    }
    await expect(
      validatePublicImageUrl(
        "https://cdn.example.com/x",
        async () => ["10.0.0.1"],
      ),
    ).rejects.toThrow();
    await expect(
      validatePublicImageUrl(
        "https://cdn.example.com/x",
        async () => ["2606:4700:4700::1111"],
      ),
    ).resolves.toBe("https://cdn.example.com/x");
  });
  it("rejects redirects, oversized bodies and non-images", async () => {
    const fetcher = vi.fn(async () =>
      new Response("x", {
        status: 302,
        headers: { location: "http://127.0.0.1" },
      })
    );
    await expect(
      fetchImageBytes(
        "https://cdn.example.com/x",
        fetcher as any,
        async () => ["8.8.8.8"],
      ),
    ).rejects.toThrow();
    fetcher.mockResolvedValue(
      new Response("html", { headers: { "content-type": "text/html" } }),
    );
    await expect(
      fetchImageBytes(
        "https://cdn.example.com/x",
        fetcher as any,
        async () => ["8.8.8.8"],
      ),
    ).rejects.toThrow();
  });
});
describe("newspaper image service authorization", () => {
  it("refuses missing permissions, caller user IDs, and missing retry keys before database access", async () => {
    const db = { from: vi.fn(), rpc: vi.fn() };
    const make = (permissions: any, key?: string) =>
      createNewspaperImageService({
        db,
        userId: "u",
        admin: db,
        permissions,
        idempotencyKey: key,
      });
    await expect(
      make({ read: true, write: false, delete: false }).execute(
        "image_generate",
        { date: "2026-09-28" },
      ),
    ).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    await expect(
      make({ read: true, write: true, delete: true }).execute(
        "image_generate",
        { date: "2026-09-28" },
      ),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      make({ read: true, write: true, delete: true }, "key").execute(
        "image_generate",
        { date: "2026-09-28", user_id: "victim" },
      ),
    ).rejects.toMatchObject({ code: "INVALID_INPUT" });
    await expect(
      make({ read: false, write: true, delete: true }, "key").execute(
        "style_list",
        {},
      ),
    ).rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    expect(db.from).not.toHaveBeenCalled();
    expect(db.rpc).not.toHaveBeenCalled();
  });
});

describe("image persistence service", () => {
  function fixture() {
    const user = "a1280000-0000-4000-8000-000000000001";
    const tables: Record<string, any[]> = {
      newspaper_image_configs: [],
      newspaper_image_styles: [],
      newspaper_image_secrets: [{ user_id: user, provider: "grsai" }],
      newspaper_image_jobs: [],
      newspaper_supplements: [],
      newspaper_image_assets: [],
      newspaper_reports: [{
        user_id: user,
        report_date: "2026-09-28",
        current_revision: 3,
        snapshot: {
          sections: [{
            id: "chronicle",
            title: "记事",
            items: [{ title: "读完一章", status: "completed" }],
          }],
        },
      }],
    };
    const db: any = {
      storage: {
        from: () => ({
          createSignedUrl: async () => ({
            data: null,
            error: { message: "missing" },
          }),
        }),
      },
    };
    db.from = vi.fn((name: string) => {
      let rows = tables[name] || [];
      let single = false;
      let fields = "*";
      const q: any = {
        select: (value: string) => {
          fields = value;
          return q;
        },
        eq: (key: string, value: any) => {
          rows = rows.filter((r) => r[key] === value);
          return q;
        },
        order: () => q,
        range: (a: number, b: number) => {
          rows = rows.slice(a, b + 1);
          return q;
        },
        maybeSingle: () => {
          single = true;
          return q;
        },
        then: (resolve: any) =>
          resolve({
            data: single
              ? (rows[0] ?? null)
              : rows.slice(0, 1000).map((r) =>
                fields === "*"
                  ? r
                  : Object.fromEntries(fields.split(",").map((k) => [k, r[k]]))
              ),
            error: null,
          }),
      };
      return q;
    });
    db.rpc = vi.fn(async (name: string, args: any) => {
      if (name === "newspaper_authorize") return { data: true, error: null };
      if (name === "newspaper_image_enqueue") {
        const j = {
          id: "j1",
          user_id: user,
          idempotency_key: args.p_key,
          request_hash: args.p_hash,
          report_date: args.p_date,
          section_id: args.p_section,
          status: "queued",
          error: null,
          asset_id: null,
          created_at: "now",
          updated_at: "now",
          provider_result: { private: "never return" },
          prompt: args.p_prompt,
          source_revision: args.p_revision,
        };
        tables.newspaper_image_jobs.push(j);
        return { data: j, error: null };
      }
      throw new Error(name);
    });
    return {
      db,
      tables,
      user,
      service: createNewspaperImageService({
        db,
        admin: db,
        userId: user,
        permissions: { read: true, write: true, delete: true },
        idempotencyKey: "stable-key",
      }),
    };
  }
  it("persists the selected report revision and replays without changing its prompt", async () => {
    const { db, tables, service } = fixture();
    const first = await service.execute("image_generate", {
      date: "2026-09-28",
    });
    expect(first).not.toHaveProperty("provider_result");
    expect(first).not.toHaveProperty("user_id");
    expect(tables.newspaper_image_jobs[0].source_revision).toBe(3);
    expect(tables.newspaper_image_jobs[0].prompt).toContain("读完一章");
    tables.newspaper_reports[0].current_revision = 4;
    expect(await service.execute("image_generate", { date: "2026-09-28" }))
      .toEqual(first);
    expect(
      db.rpc.mock.calls.filter((c: any) => c[0] === "newspaper_image_enqueue"),
    ).toHaveLength(1);
    await expect(
      service.execute("image_generate", {
        date: "2026-09-28",
        prompt: "different",
      }),
    ).rejects.toMatchObject({ code: "IDEMPOTENCY_CONFLICT" });
  });
  it("keeps the text report available when image signing fails", async () => {
    const { db, tables, user } = fixture();
    tables.newspaper_image_assets.push({
      id: "a",
      user_id: user,
      report_date: "2026-09-28",
      storage_path: "original",
      thumbnail_path: "thumbnail",
    });
    const result = await decorateNewspaperImages({
      db,
      userId: user,
      permissions: { read: true, write: false, delete: false },
    }, "2026-09-28");
    expect(result.assets).toHaveLength(1);
    expect(result.assets[0]).not.toHaveProperty("url");
  });
  it("reads every style page rather than silently truncating the first page", async () => {
    const { tables, service, user } = fixture();
    tables.newspaper_image_styles = Array.from(
      { length: 1501 },
      (_, i) => ({ id: String(i), user_id: user, name: "Style " + i }),
    );
    expect(await service.execute("style_list", {})).toHaveLength(1501);
  });
  it("checks the live database grant before privilege elevation", async () => {
    const { db, service } = fixture();
    db.rpc.mockResolvedValue({ data: false, error: null });
    await expect(service.execute("image_generate", { date: "2026-09-28" }))
      .rejects.toMatchObject({ code: "PERMISSION_DENIED" });
    expect(db.from).not.toHaveBeenCalled();
  });
  it("rejects remote and cross-user reference paths before enqueueing a paid job", async () => {
    for (
      const path of [
        "https://example.com/private.png",
        "a1280000-0000-4000-8000-000000000002/references/a1280000-0000-4000-8000-000000000003.png",
      ]
    ) {
      const { service, db } = fixture();
      await expect(
        service.execute("image_generate", {
          date: "2026-09-28",
          reference_images: [path],
        }),
      ).rejects.toMatchObject({ code: "INVALID_INPUT" });
      expect(
        db.rpc.mock.calls.some((c: any) => c[0] === "newspaper_image_enqueue"),
      ).toBe(false);
    }
  });
});
