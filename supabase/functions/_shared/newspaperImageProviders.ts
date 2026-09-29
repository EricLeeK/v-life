import {
  type ImageProvider,
  NewspaperError,
  type NewspaperImageOptions,
} from "./newspaperTypes.ts";
import { normalizeNewspaperImageOptions } from "./newspaperImageModels.ts";

export const IMAGE_MAX_BYTES = 24 * 1024 * 1024;
export const IMAGE_REFERENCE_MAX_BYTES = 8 * 1024 * 1024;
export const PROVIDER_BASE_URLS: Record<ImageProvider, string[]> = {
  grsai: ["https://grsai.dakka.com.cn", "https://grsaiapi.com"],
  openai: ["https://api.openai.com"],
  gemini: ["https://generativelanguage.googleapis.com"],
};
export interface ImageData {
  data: string;
  mime: string;
}
export type ImageResult = { state: "running"; id: string } | {
  state: "failed";
  error: string;
} | {
  state: "succeeded";
  id?: string;
  image: { url?: string; data?: string; mime?: string };
};
export type ImageFetch = typeof fetch;
export type ResolveHost = (hostname: string) => Promise<string[]>;
export class ImageProviderError extends Error {
  constructor(message: string, public definitive = false) {
    super(message);
  }
}
export function validateProviderBaseUrl(
  provider: ImageProvider,
  value?: string,
): string {
  const permitted = PROVIDER_BASE_URLS[provider];
  if (!permitted) {
    throw new NewspaperError("INVALID_INPUT", "不支持的图片供应商。");
  }
  const normalized = (value || permitted[0]).replace(/\/$/, "");
  if (!permitted.includes(normalized)) {
    throw new NewspaperError("INVALID_INPUT", "仅支持该供应商的官方服务地址。");
  }
  return normalized;
}
export function buildImageRequest(
  options: NewspaperImageOptions,
  prompt: string,
  key: string,
  refs: ImageData[],
  jobId: string,
  baseUrl?: string,
) {
  const o = normalizeNewspaperImageOptions(options),
    base = validateProviderBaseUrl(o.provider, baseUrl);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  let body: Record<string, unknown>;
  let url: string;
  if (o.provider === "grsai") {
    headers.Authorization = `Bearer ${key}`;
    url = `${base}/v1/api/generate`;
    body = {
      model: o.model,
      prompt,
      images: refs.map((r) => `data:${r.mime};base64,${r.data}`),
      replyType: "json",
      quality: o.quality,
      aspectRatio: o.model.startsWith("gpt-image") ? o.size : o.aspect_ratio,
    };
    if (!o.model.startsWith("gpt-image")) {
      body.imageSize = o.size === "auto" ? "2K" : o.size;
    }
  } else if (o.provider === "openai") {
    headers.Authorization = `Bearer ${key}`;
    headers["Idempotency-Key"] = jobId;
    url = `${base}/v1/responses`;
    body = {
      model: "gpt-5.4-mini",
      background: true,
      input: [{
        role: "user",
        content: [
          { type: "input_text", text: prompt },
          ...refs.map((r) => ({
            type: "input_image",
            image_url: `data:${r.mime};base64,${r.data}`,
          })),
        ],
      }],
      tools: [{
        type: "image_generation",
        model: o.model,
        size: o.size,
        quality: o.quality,
        output_format: "png",
      }],
      tool_choice: { type: "image_generation" },
    };
  } else {
    headers["x-goog-api-key"] = key;
    headers["Api-Revision"] = "2026-05-20";
    url = `${base}/v1beta/interactions`;
    const format: Record<string, string> = {
      type: "image",
      mime_type: "image/jpeg",
    };
    if (o.size !== "auto") format.image_size = o.size;
    if (o.aspect_ratio !== "auto") format.aspect_ratio = o.aspect_ratio;
    body = {
      model: o.model,
      // Live verification: Gemini image models reject background interactions.
      // Our durable server worker owns this request independently of the browser.
      background: false,
      input: [
        { type: "text", text: prompt },
        ...refs.map((r) => ({
          type: "image",
          data: r.data,
          mime_type: r.mime,
        })),
      ],
      response_format: format,
    };
  }
  return { url, headers, body };
}
export function parseImageResponse(
  provider: ImageProvider,
  value: any,
): ImageResult {
  if (!value || typeof value !== "object") {
    throw new ImageProviderError("图片供应商返回格式不正确。");
  }
  const status = value.status;
  if (
    ["failed", "violation", "cancelled", "canceled", "incomplete"].includes(
      status,
    ) || value.error
  ) return { state: "failed", error: "图片供应商拒绝了本次生成。" };
  const id = typeof value.id === "string" && value.id.length <= 256
    ? value.id
    : undefined;
  if (["running", "queued", "in_progress"].includes(status)) {
    if (!id) throw new ImageProviderError("图片供应商未返回任务编号。");
    return { state: "running", id };
  }
  if (
    provider === "grsai" && Array.isArray(value.results) &&
    typeof value.results[0]?.url === "string"
  ) {
    return {
      state: "succeeded",
      ...(id ? { id } : {}),
      image: { url: value.results[0].url },
    };
  }
  if (provider === "openai") {
    const item = value.output?.find((x: any) =>
      x.type === "image_generation_call" && typeof x.result === "string"
    );
    if (item) {
      return {
        state: "succeeded",
        ...(id ? { id } : {}),
        image: { data: item.result, mime: "image/png" },
      };
    }
  }
  if (provider === "gemini") {
    const item = value.output_image ??
      value.steps?.filter((x: any) => x.type === "model_output").flatMap((
        x: any,
      ) => x.content ?? []).find((x: any) =>
        x.type === "image" && typeof x.data === "string"
      );
    if (item?.data) {
      return {
        state: "succeeded",
        ...(id ? { id } : {}),
        image: { data: item.data, mime: item.mime_type || "image/png" },
      };
    }
  }
  throw new ImageProviderError("图片供应商未返回可保存的图片。");
}
export async function boundedBytes(
  response: Response,
  maxBytes: number,
): Promise<Uint8Array> {
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > maxBytes) {
    throw new ImageProviderError("图片响应超出大小限制。", true);
  }
  if (!response.body) throw new ImageProviderError("图片响应为空。", true);
  const reader = response.body.getReader();
  let total = 0;
  const chunks: Uint8Array[] = [];
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.length;
      if (total > maxBytes) {
        throw new ImageProviderError("图片响应超出大小限制。", true);
      }
      chunks.push(value);
    }
  } catch (e) {
    await reader.cancel().catch(() => {});
    throw e;
  }
  const result = new Uint8Array(total);
  let pos = 0;
  for (const chunk of chunks) {
    result.set(chunk, pos);
    pos += chunk.length;
  }
  return result;
}
async function requestJson(
  url: string,
  headers: Record<string, string>,
  body: Record<string, unknown> | null,
  fetcher: ImageFetch,
  timeout = 45000,
): Promise<any> {
  let response: Response;
  try {
    response = await fetcher(url, {
      method: body ? "POST" : "GET",
      headers,
      body: body ? JSON.stringify(body) : undefined,
      redirect: "error",
      signal: AbortSignal.timeout(timeout),
    });
  } catch {
    throw new ImageProviderError("图片供应商暂时无法连接。");
  }
  if (!response.ok) {
    throw new ImageProviderError(
      `图片供应商请求失败（${response.status}）。`,
      response.status >= 400 && response.status < 500 &&
        ![408, 409, 429].includes(response.status),
    );
  }
  const bytes = await boundedBytes(response, IMAGE_MAX_BYTES * 1.5);
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new ImageProviderError("图片供应商响应无法解析。");
  }
}
export async function submitImage(
  options: NewspaperImageOptions,
  prompt: string,
  key: string,
  refs: ImageData[],
  jobId: string,
  baseUrl: string,
  fetcher: ImageFetch = fetch,
): Promise<ImageResult> {
  const req = buildImageRequest(options, prompt, key, refs, jobId, baseUrl);
  return parseImageResponse(
    options.provider,
    await requestJson(req.url, req.headers, req.body, fetcher, options.provider === 'gemini' ? 100000 : 45000),
  );
}
export async function pollImage(
  options: NewspaperImageOptions,
  id: string,
  key: string,
  baseUrl: string,
  fetcher: ImageFetch = fetch,
): Promise<ImageResult> {
  const base = validateProviderBaseUrl(options.provider, baseUrl),
    encoded = encodeURIComponent(id);
  const url = options.provider === "grsai"
    ? `${base}/v1/api/result?id=${encoded}`
    : options.provider === "openai"
    ? `${base}/v1/responses/${encoded}`
    : `${base}/v1beta/interactions/${encoded}`;
  const headers: Record<string, string> = options.provider === "gemini"
    ? { "x-goog-api-key": key, "Api-Revision": "2026-05-20" }
    : { Authorization: `Bearer ${key}` };
  return parseImageResponse(
    options.provider,
    await requestJson(url, headers, null, fetcher),
  );
}
function isPublicIp(raw: string): boolean {
  const ip = raw.toLowerCase().replace(/^\[|\]$/g, "");
  if (ip.includes(":")) {
    return /^2[0-9a-f]{3}:/.test(ip) && !ip.startsWith("2001:db8:") &&
      !ip.startsWith("2001:0:") && !ip.startsWith("2002:");
  }
  const parts = ip.split(".").map(Number);
  if (
    parts.length !== 4 ||
    parts.some((n) => !Number.isInteger(n) || n < 0 || n > 255)
  ) return false;
  const [a, b] = parts;
  return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || b === 0 || b === 2)) ||
    (a === 198 && (b === 18 || b === 19 || b === 51)) ||
    (a === 203 && b === 0));
}
const resolveHost: ResolveHost = async (hostname) => {
  const runtime = (globalThis as any).Deno;
  if (!runtime?.resolveDns) {
    throw new ImageProviderError("图片地址解析不可用。", true);
  }
  const results = await Promise.allSettled([
    runtime.resolveDns(hostname, "A"),
    runtime.resolveDns(hostname, "AAAA"),
  ]);
  return results.flatMap((r) => r.status === "fulfilled" ? r.value : []);
};
export async function validatePublicImageUrl(
  value: string,
  resolver: ResolveHost = resolveHost,
): Promise<string> {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ImageProviderError("图片地址无效。", true);
  }
  const hostname = url.hostname.toLowerCase();
  if (
    url.protocol !== "https:" || url.username || url.password ||
    (url.port && url.port !== "443") || url.hash || hostname === "localhost" ||
    !hostname.includes(".") || hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) throw new ImageProviderError("图片地址不允许访问。", true);
  const literal = /^[\d.]+$/.test(hostname) || hostname.includes(":");
  const ips = literal ? [hostname] : await resolver(hostname);
  if (!ips.length || ips.some((ip) => !isPublicIp(ip))) {
    throw new ImageProviderError("图片地址不允许访问。", true);
  }
  return url.toString();
}
export function inspectImage(
  bytes: Uint8Array,
): { mime: string; width: number; height: number; extension: string } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let width = 0, height = 0, mime = "", extension = "";
  if (
    bytes.length >= 24 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)
  ) {
    mime = "image/png";
    extension = "png";
    width = view.getUint32(16);
    height = view.getUint32(20);
  } else if (bytes.length >= 12 && bytes[0] === 255 && bytes[1] === 216) {
    mime = "image/jpeg";
    extension = "jpg";
    let pos = 2;
    while (pos + 9 < bytes.length) {
      if (bytes[pos] !== 255) {
        pos++;
        continue;
      }
      const marker = bytes[pos + 1];
      if (marker === 0xda || marker === 0xd9) break;
      const length = view.getUint16(pos + 2);
      if (length < 2) break;
      if (
        [
          0xc0,
          0xc1,
          0xc2,
          0xc3,
          0xc5,
          0xc6,
          0xc7,
          0xc9,
          0xca,
          0xcb,
          0xcd,
          0xce,
          0xcf,
        ].includes(marker)
      ) {
        height = view.getUint16(pos + 5);
        width = view.getUint16(pos + 7);
        break;
      }
      pos += length + 2;
    }
  } else if (
    bytes.length >= 30 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) {
    mime = "image/webp";
    extension = "webp";
    const kind = String.fromCharCode(...bytes.slice(12, 16));
    if (kind === "VP8X") {
      width = 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16);
      height = 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16);
    } else if (
      kind === "VP8 " && bytes[23] === 0x9d && bytes[24] === 1 &&
      bytes[25] === 0x2a
    ) {
      width = view.getUint16(26, true) & 0x3fff;
      height = view.getUint16(28, true) & 0x3fff;
    } else if (kind === "VP8L" && bytes[20] === 0x2f) {
      const bits = view.getUint32(21, true);
      width = (bits & 0x3fff) + 1;
      height = ((bits >>> 14) & 0x3fff) + 1;
    }
  }
  if (
    !width || !height || width > 16384 || height > 16384 ||
    width * height > 32_000_000
  ) throw new ImageProviderError("图片格式或尺寸不受支持。", true);
  return { mime, width, height, extension };
}
export function decodeImage(
  data: string,
  mime?: string,
  max = IMAGE_MAX_BYTES,
): Uint8Array {
  if (
    typeof data !== "string" || data.length > Math.ceil(max / 3) * 4 ||
    !data.length || !/^[A-Za-z0-9+/]*={0,2}$/.test(data) ||
    data.length % 4 !== 0
  ) throw new ImageProviderError("图片数据无效或超出大小限制。", true);
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(atob(data), (c) => c.charCodeAt(0));
  } catch {
    throw new ImageProviderError("图片编码无效。", true);
  }
  const info = inspectImage(bytes);
  if (bytes.length > max || (mime && mime !== info.mime)) {
    throw new ImageProviderError("图片格式或大小不匹配。", true);
  }
  return bytes;
}
export function encodeImage(bytes: Uint8Array): string {
  let raw = "";
  for (let i = 0; i < bytes.length; i += 8192) {
    raw += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return btoa(raw);
}
export async function fetchImageBytes(
  url: string,
  fetcher: ImageFetch = fetch,
  resolver: ResolveHost = resolveHost,
): Promise<Uint8Array> {
  const safe = await validatePublicImageUrl(url, resolver);
  const response = await fetcher(safe, {
    redirect: "error",
    signal: AbortSignal.timeout(45000),
  });
  if (
    !response.ok ||
    !["image/png", "image/jpeg", "image/webp"].includes(
      (response.headers.get("content-type") || "").split(";")[0].trim(),
    )
  ) throw new ImageProviderError("无法下载图片或格式不受支持。", true);
  const bytes = await boundedBytes(response, IMAGE_MAX_BYTES);
  inspectImage(bytes);
  return bytes;
}
