import { type NewspaperImageOptions } from "./newspaperTypes.ts";
import { resizeNewspaperImage } from "./newspaperImageResize.ts";
import {
  decodeImage,
  encodeImage,
  fetchImageBytes,
  IMAGE_MAX_BYTES,
  IMAGE_REFERENCE_MAX_BYTES,
  type ImageData,
  type ImageFetch,
  ImageProviderError,
  type ImageResult,
  inspectImage,
  pollImage,
  type ResolveHost,
  submitImage,
} from "./newspaperImageProviders.ts";

const BUCKET = "newspaper-images";
interface ImageJobRow {
  id: string;
  user_id: string;
  report_date: string;
  section_id: string;
  status: string;
  lease_token: string;
  attempts: number;
  created_at: string;
  prompt: string;
  options: NewspaperImageOptions;
  reference_images: string[];
  base_url: string;
  provider_job_id: string | null;
  provider_result: any;
}
interface WorkerOptions {
  fetch?: ImageFetch;
  resolveHost?: ResolveHost;
  limit?: number;
}
async function rpc(db: any, name: string, args: any) {
  const { data, error } = await db.rpc(name, args);
  if (error) throw new Error("图片任务数据库暂时不可用。");
  return data;
}
async function checkpoint(
  db: any,
  j: ImageJobRow,
  status: string,
  extra: { id?: string; image?: any; error?: string; delay?: number } = {},
) {
  return rpc(db, "newspaper_image_checkpoint", {
    p_id: j.id,
    p_lease: j.lease_token,
    p_status: status,
    p_provider_id: extra.id ?? null,
    p_result: extra.image ?? null,
    p_error: extra.error ?? null,
    p_delay: extra.delay ?? 30,
  });
}
async function credentials(db: any, j: ImageJobRow): Promise<string> {
  const { data, error } = await db.from("newspaper_image_secrets").select(
    "api_key",
  ).eq("user_id", j.user_id).eq("provider", j.options.provider).maybeSingle();
  if (error || !data?.api_key) {
    throw new ImageProviderError("未找到该供应商的图片 API Key。", true);
  }
  return data.api_key;
}
async function references(db: any, j: ImageJobRow): Promise<ImageData[]> {
  const images: ImageData[] = [];
  let total = 0;
  for (const path of j.reference_images) {
    if (
      typeof path !== "string" ||
      !path.startsWith(`${j.user_id}/references/`) || path.includes("..")
    ) throw new ImageProviderError("参考图路径不正确。", true);
    const { data, error } = await db.storage.from(BUCKET).download(path);
    if (error || !data) {
      throw new ImageProviderError("参考图已失效，请重新上传。", true);
    }
    if (data.size > IMAGE_REFERENCE_MAX_BYTES) {
      throw new ImageProviderError("参考图超出大小限制。", true);
    }
    const bytes = new Uint8Array(await data.arrayBuffer());
    total += bytes.length;
    if (total > 20 * 1024 * 1024) {
      throw new ImageProviderError("参考图总大小不可超过 20 MB。", true);
    }
    const info = inspectImage(bytes);
    images.push({ data: encodeImage(bytes), mime: info.mime });
  }
  return images;
}
interface SavedOriginal {
  path: string;
  width: number;
  height: number;
  bytes: number;
}
function originalPaths(j: ImageJobRow): string[] {
  return ["png", "jpg", "webp"].map((extension) =>
    `${j.user_id}/originals/${j.id}.${extension}`
  );
}
async function recoverOriginal(
  bucket: any,
  j: ImageJobRow,
): Promise<{ stored: SavedOriginal; bytes: Uint8Array } | null> {
  // Upload may have committed even when its following database checkpoint did not.
  // Only probe this user's deterministic paths for this exact job.
  for (const path of originalPaths(j)) {
    const { data, error } = await bucket.download(path);
    if (error) {
      const code = String(error.statusCode ?? error.status ?? error.code ?? "");
      if (
        ["404", "not_found", "NoSuchKey"].includes(code) ||
        error.message === "Object not found"
      ) continue;
      // An outage is not proof of absence: do not fall back to a possibly expired URL.
      throw new Error("已保存的原图暂时无法确认。");
    }
    if (!data) throw new Error("已保存的原图响应为空。");
    if (data.size > IMAGE_MAX_BYTES) {
      throw new ImageProviderError("原图超出大小限制。", true);
    }
    const bytes = new Uint8Array(await data.arrayBuffer());
    if (bytes.length > IMAGE_MAX_BYTES) {
      throw new ImageProviderError("原图超出大小限制。", true);
    }
    const info = inspectImage(bytes);
    if (!path.endsWith(`.${info.extension}`)) {
      throw new ImageProviderError("原图格式与存储记录不匹配。", true);
    }
    return {
      stored: {
        path,
        width: info.width,
        height: info.height,
        bytes: bytes.length,
      },
      bytes,
    };
  }
  return null;
}
async function saveResult(
  db: any,
  j: ImageJobRow,
  options: WorkerOptions,
): Promise<void> {
  const fetcher = options.fetch ?? fetch,
    bucket = db.storage.from(BUCKET),
    saved = j.provider_result?.stored;
  let stored: SavedOriginal | undefined = saved;
  let originalBytes: Uint8Array | undefined;
  if (!stored) {
    const recovered = await recoverOriginal(bucket, j);
    if (recovered) {
      stored = recovered.stored;
      originalBytes = recovered.bytes;
    } else {
      const image = j.provider_result;
      const bytes = image?.data
        ? decodeImage(image.data, image.mime)
        : image?.url
        ? await fetchImageBytes(image.url, fetcher, options.resolveHost)
        : (() => {
          throw new ImageProviderError("任务没有可保存的图片。", true);
        })();
      const info = inspectImage(bytes),
        path = `${j.user_id}/originals/${j.id}.${info.extension}`;
      const { error } = await bucket.upload(path, bytes, {
        contentType: info.mime,
        upsert: true,
      });
      if (error) throw new Error("原图保存暂时失败。");
      stored = {
        path,
        width: info.width,
        height: info.height,
        bytes: bytes.length,
      };
      originalBytes = bytes;
    }
    if (!await checkpoint(db, j, "saving", { image: { stored }, delay: 0 })) {
      return;
    }
    j.provider_result = { stored };
  }
  if (!originalPaths(j).includes(stored.path)) {
    throw new ImageProviderError("原图存储路径不正确。", true);
  }
  // Resize locally; no paid Storage transformation feature is required.
  if (!originalBytes) {
    const original = await bucket.download(stored.path);
    if (original.error || !original.data) {
      throw new Error("已保存的原图暂时无法读取。");
    }
    originalBytes = new Uint8Array(await original.data.arrayBuffer());
  }
  const thumbnail = await resizeNewspaperImage(originalBytes);
  const info = inspectImage(thumbnail);
  if (
    info.width > 640 || info.height > 640 ||
    ((stored.width > 640 || stored.height > 640) &&
      thumbnail.length >= stored.bytes)
  ) throw new Error("缩略图尚未完成压缩。");
  const thumbPath = `${j.user_id}/thumbnails/${j.id}.${info.extension}`;
  const { error } = await bucket.upload(thumbPath, thumbnail, {
    contentType: info.mime,
    upsert: true,
  });
  if (error) throw new Error("缩略图保存暂时失败。");
  await rpc(db, "newspaper_image_finish", {
    p_id: j.id,
    p_lease: j.lease_token,
    p_path: stored.path,
    p_thumbnail: thumbPath,
    p_width: stored.width,
    p_height: stored.height,
  });
}
async function persistResult(
  db: any,
  j: ImageJobRow,
  result: ImageResult,
  options: WorkerOptions,
) {
  if (result.state === "failed") {
    await checkpoint(db, j, "failed", { error: result.error });
    return;
  }
  if (result.state === "running") {
    await checkpoint(db, j, "running", { id: result.id });
    return;
  }
  if (
    !await checkpoint(db, j, "saving", {
      id: result.id,
      image: result.image,
      delay: 0,
    })
  ) return;
  j.status = "saving";
  j.provider_result = result.image;
  await saveResult(db, j, options);
}
/** One short polling step per leased job; cron continues jobs even after the browser closes. */
export async function processNewspaperImageJobs(
  admin: any,
  options: WorkerOptions = {},
): Promise<{ claimed: number; processed: number; errors: number }> {
  const jobs: ImageJobRow[] = await rpc(admin, "newspaper_image_claim", {
    p_limit: options.limit ?? 1,
  });
  const stats = { claimed: jobs.length, processed: 0, errors: 0 };
  for (const j of jobs) {
    let submitting = false;
    try {
      if (j.status === "saving") {
        await saveResult(admin, j, options);
        stats.processed++;
        continue;
      }
      const key = await credentials(admin, j);
      if (j.status === "queued") {
        const refs = await references(admin, j);
        if (!await checkpoint(admin, j, "submitting", { delay: 0 })) continue;
        submitting = true;
        const response = await submitImage(
          j.options,
          j.prompt,
          key,
          refs,
          j.id,
          j.base_url,
          options.fetch,
        );
        // Keep submitting=true until the accepted result has been durably checkpointed.
        await persistResult(admin, j, response, options);
        submitting = false;
      } else if (j.status === "running") {
        if (!j.provider_job_id) {
          await checkpoint(admin, j, "unknown", {
            error: "图片供应商任务编号缺失，请核对供应商记录。",
          });
          continue;
        }
        await persistResult(
          admin,
          j,
          await pollImage(
            j.options,
            j.provider_job_id,
            key,
            j.base_url,
            options.fetch,
          ),
          options,
        );
      }
      stats.processed++;
    } catch (error) {
      stats.errors++;
      const definitive = error instanceof ImageProviderError &&
        error.definitive;
      // j.status changes to saving only after output persistence, so storage failures can safely retry.
      let status = j.status === "saving"
        ? "saving"
        : submitting
        ? "unknown"
        : j.status === "running"
        ? "running"
        : "failed";
      if (definitive) status = "failed";
      if (
        status === "running" &&
        Date.now() - Date.parse(j.created_at) > 24 * 3600 * 1000
      ) status = "failed";
      const message = status === "unknown"
        ? "提交结果暂不确定，请核对供应商记录；系统不会自动重复扣费。"
        : status === "saving"
        ? "图片已生成，保存暂时失败，后台会继续重试。"
        : status === "running"
        ? "图片供应商仍在处理，后台会继续查询。"
        : error instanceof ImageProviderError
        ? error.message
        : "图片任务暂时失败，请稍后重试。";
      // Never include supplier response bodies, URLs, or API keys in public errors or logs.
      await checkpoint(admin, j, status, {
        error: message,
        delay: status === "saving" ? 60 : 30,
      }).catch(() => {});
    }
  }
  return stats;
}
