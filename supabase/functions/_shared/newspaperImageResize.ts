import {
  ImageMagick,
  initializeImageMagick,
  MagickFormat,
} from "npm:@imagemagick/magick-wasm@0.0.43";
import {
  boundedBytes,
  ImageProviderError,
  inspectImage,
} from "./newspaperImageProviders.ts";

const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@imagemagick/magick-wasm@0.0.43/dist/x86/magick.wasm";
const WASM_SHA256 =
  "5a4ed1017eda113144c86ae839c22c610afebcfebfa22b1da18e00e98d78b0f7";
let ready: Promise<void> | undefined;
async function initialize() {
  let wasm: Uint8Array;
  try {
    // Available in normal Deno npm installations; Edge bundlers may omit package assets.
    wasm = await Deno.readFile(
      new URL(
        import.meta.resolve("npm:@imagemagick/magick-wasm@0.0.43/magick.wasm"),
      ),
    );
  } catch {
    // This fetch downloads only the pinned executable; no user image leaves the worker.
    const response = await fetch(WASM_URL, {
      redirect: "error",
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) throw new Error("缩略图处理模块暂时不可用。");
    wasm = await boundedBytes(response, 32 * 1024 * 1024);
  }
  const digest = Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", wasm as Uint8Array<ArrayBuffer>),
    ),
    (x) => x.toString(16).padStart(2, "0"),
  ).join("");
  if (digest !== WASM_SHA256) throw new Error("缩略图处理模块校验未通过。");
  await initializeImageMagick(wasm);
}
/** A real 640px thumbnail, encoded independently from the preserved original. */
export async function resizeNewspaperImage(
  bytes: Uint8Array,
): Promise<Uint8Array> {
  inspectImage(bytes);
  ready ??= initialize().catch((error) => {
    ready = undefined;
    throw error;
  });
  await ready;
  try {
    return ImageMagick.read(bytes, (image) => {
      image.autoOrient();
      const ratio = Math.min(1, 640 / image.width, 640 / image.height);
      image.resize(
        Math.max(1, Math.round(image.width * ratio)),
        Math.max(1, Math.round(image.height * ratio)),
      );
      image.strip();
      image.quality = 65;
      return image.write(MagickFormat.WebP, (output) => new Uint8Array(output));
    });
  } catch {
    throw new ImageProviderError("生成的图片无法解码，请重新生成。", true);
  }
}
