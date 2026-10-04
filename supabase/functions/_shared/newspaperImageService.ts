import {
  type NewspaperContext,
  NewspaperError,
  type NewspaperImageAsset,
  type NewspaperImageConfig,
  type NewspaperImageJob,
  type NewspaperStyle,
} from "./newspaperTypes.ts";
import {
  DEFAULT_NEWSPAPER_IMAGE_OPTIONS,
  DEFAULT_NEWSPAPER_IMAGE_PROMPT,
  NEWSPAPER_IMAGE_MODELS,
  normalizeNewspaperImageOptions,
  renderNewspaperImagePrompt,
  composeNewspaperImagePrompt,
} from "./newspaperImageModels.ts";
import {
  decodeImage,
  IMAGE_REFERENCE_MAX_BYTES,
  inspectImage,
  validateProviderBaseUrl,
} from "./newspaperImageProviders.ts";

const BUCKET = "newspaper-images";
const JOB_COLUMNS =
  "id,report_date,section_id,status,error,asset_id,created_at,updated_at";
const STYLE_COLUMNS =
  "id,name,prompt_template,is_default,provider,model,size,quality,aspect_ratio,reference_images,created_at,updated_at";
const ASSET_COLUMNS =
  "id,report_date,section_id,storage_path,thumbnail_path,width,height,caption,active,prompt,style_snapshot,options,source_revision,created_at";
const sections = [
  "main",
  "chronicle",
  "learning",
  "finance",
  "health",
  "thoughts",
];
const readActions = ["style_list", "image_config_get", "image_status"];
const writeActions = [
  "style_save",
  "image_config_save",
  "image_generate",
  "image_select",
  "image_caption",
  "reference_upload",
];
function invalid(message = "图片操作参数不正确。"): never {
  throw new NewspaperError("INVALID_INPUT", message);
}
function validateKeys(input: Record<string, unknown>, keys: string[]) {
  if (Object.keys(input).some((k) => !keys.includes(k))) invalid();
}
function text(value: unknown, min: number, max: number) {
  if (
    typeof value !== "string" || value.trim().length < min || value.length > max
  ) invalid();
  return value.trim();
}
function uuid(value: unknown) {
  const s = text(value, 36, 36);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
  ) invalid();
  return s;
}
function date(value: unknown) {
  const s = text(value, 10, 10);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(s) ||
    !Number.isFinite(Date.parse(`${s}T00:00:00Z`)) ||
    new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) !== s
  ) invalid();
  return s;
}
function plain(value: unknown): Record<string, any> {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
  return value as Record<string, any>;
}
function cleanOptions(value: unknown) {
  const o = plain(value);
  validateKeys(o, ["provider", "model", "size", "quality", "aspect_ratio"]);
  for (const v of Object.values(o)) if (typeof v !== "string") invalid();
  return o;
}
function refs(value: unknown, userId: string): string[] {
  if (!Array.isArray(value) || value.length > 14) invalid();
  return value.map((v) => {
    if (
      typeof v !== "string" ||
      !new RegExp(`^${userId}/references/[0-9a-f-]{36}\\.(png|jpg|webp)$`, "i")
        .test(v)
    ) invalid("参考图片必须先上传到自己的图片库。");
    return v;
  });
}
function dbError(error: any): never {
  const known = [
    "IDEMPOTENCY_CONFLICT",
    "STYLE_CONFLICT",
    "REPORT_NOT_FOUND",
    "NOT_FOUND",
    "LEASE_LOST",
  ];
  const code = known.find((c) => String(error?.message).includes(c));
  throw new NewspaperError(
    code || "DATABASE_ERROR",
    code === "IDEMPOTENCY_CONFLICT"
      ? "重试标识已用于另一次生成，请使用新的标识。"
      : code === "STYLE_CONFLICT"
      ? "风格已被修改，请刷新后重试。"
      : code === "REPORT_NOT_FOUND"
      ? "请先保存或刷新这一天的日报。"
      : "图片数据操作未成功，请稍后重试。",
    code?.endsWith("CONFLICT") ? 409 : 400,
  );
}
async function result(query: any) {
  const { data, error } = await query;
  if (error) dbError(error);
  return data;
}
async function allRows(build: () => any) {
  const rows: any[] = [];
  for (let offset = 0;; offset += 200) {
    const page = await result(build().range(offset, offset + 199));
    rows.push(...(page || []));
    if (!page || page.length < 200) return rows;
  }
}
export function publicNewspaperImageJob(row: any): NewspaperImageJob {
  return Object.fromEntries(
    JOB_COLUMNS.split(",").map((k) => [k, row[k]]),
  ) as unknown as NewspaperImageJob;
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object") {
    return "{" + Object.keys(value).sort().filter((k) =>
      (value as any)[k] !== undefined
    ).map((k) => JSON.stringify(k) + ":" + canonical((value as any)[k])).join(
      ",",
    ) + "}";
  }
  return JSON.stringify(value);
}
async function fingerprint(value: unknown) {
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonical(value)),
  );
  return Array.from(
    new Uint8Array(bytes),
    (v) => v.toString(16).padStart(2, "0"),
  ).join("");
}
async function signAsset(
  db: any,
  row: NewspaperImageAsset,
): Promise<NewspaperImageAsset> {
  const safe = Object.fromEntries(
    ASSET_COLUMNS.split(",").map((k) => [k, (row as any)[k]]),
  ) as unknown as NewspaperImageAsset;
  try {
    const storage = db.storage.from(BUCKET);
    const signed = await Promise.allSettled([
      storage.createSignedUrl(row.storage_path, 3600),
      storage.createSignedUrl(row.thumbnail_path, 3600),
    ]);
    const original = signed[0].status === "fulfilled" && !signed[0].value.error
      ? signed[0].value.data?.signedUrl
      : undefined;
    const thumbnail = signed[1].status === "fulfilled" && !signed[1].value.error
      ? signed[1].value.data?.signedUrl
      : undefined;
    return {
      ...safe,
      ...(original ? { url: original } : {}),
      ...(thumbnail ? { thumbnail_url: thumbnail } : {}),
    };
  } catch {
    return safe;
  }
}
export async function decorateNewspaperImages(
  ctx: NewspaperContext,
  reportDate: string,
): Promise<{ assets: NewspaperImageAsset[]; jobs: NewspaperImageJob[] }> {
  if (!ctx.permissions.read) {
    throw new NewspaperError("PERMISSION_DENIED", "需要读取日报权限。", 403);
  }
  const [assets, jobs] = await Promise.all([
    allRows(() =>
      ctx.db.from("newspaper_image_assets").select(ASSET_COLUMNS).eq(
        "user_id",
        ctx.userId,
      ).eq("report_date", reportDate).order("created_at", { ascending: false })
        .order("id", { ascending: false })
    ),
    allRows(() =>
      ctx.db.from("newspaper_image_jobs").select(JOB_COLUMNS).eq(
        "user_id",
        ctx.userId,
      ).eq("report_date", reportDate).order("created_at", { ascending: false })
        .order("id", { ascending: false })
    ),
  ]);
  return {
    assets: await Promise.all(
      (assets || []).map((a: NewspaperImageAsset) => signAsset(ctx.db, a)),
    ),
    jobs: (jobs || []).map(publicNewspaperImageJob),
  };
}
export function createNewspaperImageService(ctx: NewspaperContext) {
  const readConfig = async (): Promise<NewspaperImageConfig> => {
    const row = await result(
      ctx.db.from("newspaper_image_configs").select(
        "provider,model,size,quality,aspect_ratio,base_url,configured,key_hint",
      ).eq("user_id", ctx.userId).maybeSingle(),
    );
    return row ||
      {
        ...DEFAULT_NEWSPAPER_IMAGE_OPTIONS,
        base_url: validateProviderBaseUrl("grsai"),
        configured: false,
        key_hint: null,
      };
  };
  const admin = () => {
    if (!ctx.admin) {
      throw new NewspaperError("SERVER_CONFIGURATION", "图片服务未配置。", 503);
    }
    return ctx.admin;
  };
  async function authorize(operation: "read" | "write" | "delete") {
    const { data, error } = await ctx.db.rpc("newspaper_authorize", {
      p_operation: operation,
    });
    if (error) dbError(error);
    if (data !== true) {
      throw new NewspaperError(
        "PERMISSION_DENIED",
        "此客户端没有图片操作权限。",
        403,
      );
    }
  }
  return {
    async execute(action: string, raw: unknown = {}): Promise<any> {
      if (
        !readActions.includes(action) && !writeActions.includes(action) &&
        action !== "style_delete"
      ) throw new NewspaperError("INVALID_ACTION", "不支持的图片操作。");
      if (
        !ctx.permissions.read ||
        (writeActions.includes(action) && !ctx.permissions.write) ||
        (action === "style_delete" && !ctx.permissions.delete)
      ) {
        throw new NewspaperError(
          "PERMISSION_DENIED",
          "此客户端没有图片操作权限。",
          403,
        );
      }
      const input = plain(raw);
      const allowed: Record<string, string[]> = {
        style_list: [],
        image_config_get: [],
        image_config_save: [
          "provider",
          "model",
          "size",
          "quality",
          "aspect_ratio",
          "base_url",
          "api_key",
        ],
        style_save: [
          "id",
          "name",
          "prompt_template",
          "is_default",
          "provider",
          "model",
          "size",
          "quality",
          "aspect_ratio",
          "reference_images",
          "expected_updated_at",
        ],
        style_delete: ["id"],
        image_generate: [
          "date",
          "section_id",
          "style_id",
          "prompt",
          "options",
          "reference_images",
        ],
        image_status: ["date", "id"],
        image_select: ["date", "id"],
        image_caption: ["date", "id", "caption"],
        reference_upload: ["base64", "mime", "filename"],
      };
      validateKeys(input, allowed[action]);
      if (
        action === "image_generate" &&
        (!ctx.idempotencyKey?.trim() || ctx.idempotencyKey.length > 200)
      ) invalid("生成图片需要 1–200 字的重试标识。");
      await authorize("read");
      if (writeActions.includes(action)) await authorize("write");
      if (action === "style_delete") await authorize("delete");
      if (action === "style_list") {
        return allRows(() =>
          ctx.db.from("newspaper_image_styles").select(STYLE_COLUMNS).eq(
            "user_id",
            ctx.userId,
          ).order("created_at", { ascending: true }).order("id", {
            ascending: true,
          })
        );
      }
      if (action === "image_config_get") return readConfig();
      if (action === "image_config_save") {
        const existing = await readConfig();
        const options = normalizeNewspaperImageOptions(
          Object.fromEntries(
            ["provider", "model", "size", "quality", "aspect_ratio"].filter(
              (k) => input[k] !== undefined,
            ).map((k) => [k, input[k]]),
          ),
          existing,
        );
        const base_url = validateProviderBaseUrl(
          options.provider,
          input.base_url ??
            (existing.provider === options.provider
              ? existing.base_url
              : undefined),
        );
        const key = input.api_key === undefined || input.api_key === ""
          ? null
          : text(input.api_key, 8, 4096);
        return result(
          admin().rpc("newspaper_image_config_set", {
            p_user_id: ctx.userId,
            p_config: { ...options, base_url },
            p_api_key: key,
          }),
        );
      }
      if (action === "style_save") {
        const style: any = {
          name: text(input.name, 1, 80),
          prompt_template: text(input.prompt_template, 1, 16000),
          is_default: input.is_default ?? false,
          reference_images: refs(input.reference_images ?? [], ctx.userId),
        };
        if (typeof style.is_default !== "boolean") invalid();
        if (input.id !== undefined) style.id = uuid(input.id);
        for (
          const key of ["provider", "model", "size", "quality", "aspect_ratio"]
        ) style[key] = input[key] ?? null;
        const partial = Object.fromEntries(
          ["provider", "model", "size", "quality", "aspect_ratio"].filter((k) =>
            style[k] !== null
          ).map((k) => [k, style[k]]),
        );
        if (Object.keys(partial).length) {
          normalizeNewspaperImageOptions(
            partial,
            await readConfig(),
          );
        }
        renderNewspaperImagePrompt(style.prompt_template, {
          date: "",
          content: "",
          section: "",
        });
        if (
          input.expected_updated_at !== undefined &&
          (!Number.isFinite(Date.parse(input.expected_updated_at)))
        ) invalid();
        return result(
          admin().rpc("newspaper_image_style_save", {
            p_user_id: ctx.userId,
            p_style: style,
            p_expected_updated_at: input.expected_updated_at ?? null,
          }),
        );
      }
      if (action === "style_delete") {
        const deleted = await result(
          admin().from("newspaper_image_styles").delete().eq(
            "user_id",
            ctx.userId,
          ).eq("id", uuid(input.id)).select("id"),
        );
        if (!deleted?.length) {
          throw new NewspaperError(
            "NOT_FOUND",
            "未找到该风格。",
            404,
          );
        }
        return { id: deleted[0].id, deleted: true };
      }
      if (action === "reference_upload") {
        text(input.filename, 1, 240);
        const mime = text(input.mime, 1, 60);
        const bytes = decodeImage(
            input.base64,
            mime,
            IMAGE_REFERENCE_MAX_BYTES,
          ),
          info = inspectImage(bytes);
        const path =
          `${ctx.userId}/references/${crypto.randomUUID()}.${info.extension}`;
        const bucket = admin().storage.from(BUCKET);
        const upload = await bucket.upload(path, bytes, {
          contentType: info.mime,
          upsert: false,
        });
        if (upload.error) {
          throw new NewspaperError(
            "STORAGE_ERROR",
            "参考图上传失败。",
            503,
          );
        }
        const signed = await bucket.createSignedUrl(path, 3600);
        if (signed.error) {
          throw new NewspaperError(
            "STORAGE_ERROR",
            "参考图预览失败。",
            503,
          );
        }
        return { path, url: signed.data.signedUrl };
      }
      if (action === "image_status") {
        if (!input.id && !input.date) invalid("请指定日期或任务编号。");
        const id = input.id ? uuid(input.id) : undefined,
          reportDate = input.date ? date(input.date) : undefined;
        return (await allRows(() => {
          let query = ctx.db.from("newspaper_image_jobs").select(JOB_COLUMNS)
            .eq("user_id", ctx.userId);
          if (id) query = query.eq("id", id);
          if (reportDate) query = query.eq("report_date", reportDate);
          return query.order("created_at", { ascending: false }).order("id", {
            ascending: false,
          });
        })).map(publicNewspaperImageJob);
      }
      if (action === "image_generate") {
        const reportDate = date(input.date),
          section = text(input.section_id ?? "main", 1, 20);
        if (!sections.includes(section)) invalid();
        const identity = { ...input, date: reportDate, section_id: section };
        const hash = await fingerprint(identity);
        const existing = await result(
          admin().from("newspaper_image_jobs").select("*").eq(
            "user_id",
            ctx.userId,
          ).eq("idempotency_key", ctx.idempotencyKey).maybeSingle(),
        );
        if (existing) {
          if (existing.request_hash !== hash) {
            throw new NewspaperError(
              "IDEMPOTENCY_CONFLICT",
              "重试标识已用于另一次生成。",
              409,
            );
          }
          return publicNewspaperImageJob(existing);
        }
        const config = await readConfig();
        let style: NewspaperStyle | null = null;
        let styleQuery = ctx.db.from("newspaper_image_styles").select(
          STYLE_COLUMNS,
        ).eq("user_id", ctx.userId);
        styleQuery = input.style_id
          ? styleQuery.eq("id", uuid(input.style_id))
          : styleQuery.eq("is_default", true);
        style = await result(styleQuery.maybeSingle());
        if (input.style_id && !style) {
          throw new NewspaperError(
            "NOT_FOUND",
            "未找到该提示词风格。",
            404,
          );
        }
        const styleOptions = style
          ? Object.fromEntries(
            ["provider", "model", "size", "quality", "aspect_ratio"].filter(
              (k) => (style as any)[k] !== null,
            ).map((k) => [k, (style as any)[k]]),
          )
          : {};
        const options = normalizeNewspaperImageOptions(
          input.options === undefined ? {} : cleanOptions(input.options),
          normalizeNewspaperImageOptions(styleOptions, config),
        );
        if (NEWSPAPER_IMAGE_MODELS.find(model => model.provider === options.provider && model.id === options.model)?.available === false) {
          throw new NewspaperError('MODEL_UNAVAILABLE', '该模型当前暂停开放，请换一个模型。');
        }
        const reference_images = refs(
          input.reference_images ?? style?.reference_images ?? [],
          ctx.userId,
        );
        if (
          reference_images.length >
            NEWSPAPER_IMAGE_MODELS.find((m) =>
              m.provider === options.provider && m.id === options.model
            )!.reference_limit
        ) invalid("参考图数量超出模型限制。");
        const credential = await result(
          admin().from("newspaper_image_secrets").select("user_id").eq(
            "user_id",
            ctx.userId,
          ).eq("provider", options.provider).maybeSingle(),
        );
        if (!credential) {
          throw new NewspaperError(
            "IMAGE_KEY_REQUIRED",
            "请先为图片供应商保存自己的 API Key。",
          );
        }
        let report = await result(
          ctx.db.from("newspaper_reports").select("current_revision,snapshot,status")
            .eq("user_id", ctx.userId).eq("report_date", reportDate)
            .maybeSingle(),
        );
        if (!report || report.status === 'draft') {
          const { createNewspaperService } = await import('./newspaperService.ts');
          const refreshed = await createNewspaperService(ctx).execute('refresh', {date: reportDate});
          report = {current_revision: refreshed.revision, snapshot: refreshed.snapshot};
        }
        const supplements = section === "main" || section === 'thoughts'
          ? await allRows(() =>
            ctx.db.from("newspaper_supplements").select("body,occurred_at").eq(
              "user_id",
              ctx.userId,
            ).eq("report_date", reportDate).order("created_at", {
              ascending: true,
            }).order("id", { ascending: true })
          )
          : [];
        const template = style?.prompt_template || DEFAULT_NEWSPAPER_IMAGE_PROMPT;
        const prompt = input.prompt === undefined
          ? composeNewspaperImagePrompt(template, {date: reportDate, snapshot: report.snapshot, supplements: supplements || []}, section)
          : text(input.prompt, 1, 48000);
        const stamp = (ctx.now?.() ?? new Date()).toISOString();
        const styleSnapshot: NewspaperStyle = {
          ...(style ?? {
            id: "builtin",
            name: input.prompt === undefined
              ? "内置默认提示词"
              : "本次自定义提示词",
            is_default: true,
            provider: null,
            model: null,
            size: null,
            quality: null,
            aspect_ratio: null,
            created_at: stamp,
            updated_at: stamp,
          }),
          prompt_template: template,
          reference_images,
        };
        const job = await result(
          admin().rpc("newspaper_image_enqueue", {
            p_user_id: ctx.userId,
            p_key: ctx.idempotencyKey,
            p_hash: hash,
            p_date: reportDate,
            p_section: section,
            p_prompt: prompt,
            p_style: styleSnapshot,
            p_options: options,
            p_revision: report.current_revision,
            p_refs: reference_images,
            p_base_url: validateProviderBaseUrl(
              options.provider,
              config.provider === options.provider
                ? config.base_url
                : undefined,
            ),
          }),
        );
        return publicNewspaperImageJob(job);
      }
      const id = uuid(input.id);
      let assetQuery = ctx.db.from("newspaper_image_assets").select(
        ASSET_COLUMNS,
      ).eq("user_id", ctx.userId).eq("id", id);
      if (input.date) {
        assetQuery = assetQuery.eq("report_date", date(input.date));
      }
      const asset = await result(assetQuery.maybeSingle());
      if (!asset) throw new NewspaperError("NOT_FOUND", "未找到该图片。", 404);
      if (action === "image_select") {
        const selected = await result(
          admin().rpc("newspaper_image_select", {
            p_user_id: ctx.userId,
            p_id: id,
          }),
        );
        return signAsset(ctx.db, selected);
      }
      const caption = text(input.caption, 0, 2000);
      const updated = await result(
        admin().from("newspaper_image_assets").update({ caption }).eq(
          "user_id",
          ctx.userId,
        ).eq("id", id).select(ASSET_COLUMNS).single(),
      );
      return signAsset(ctx.db, updated);
    },
  };
}
