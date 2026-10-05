import {
  ImageMagick,
  initializeImageMagick,
  MagickColors,
  MagickFormat,
} from "npm:@imagemagick/magick-wasm@0.0.43";
import { resizeNewspaperImage } from "./newspaperImageResize.ts";
import { inspectImage } from "./newspaperImageProviders.ts";

Deno.test("server-side WASM generates real 640px thumbnails from PNG, JPEG and WebP", async () => {
  const wasm = await Deno.readFile(
    new URL(
      import.meta.resolve("npm:@imagemagick/magick-wasm@0.0.43/magick.wasm"),
    ),
  );
  await initializeImageMagick(wasm);
  for (
    const format of [MagickFormat.Png, MagickFormat.Jpeg, MagickFormat.WebP]
  ) {
    let source: Uint8Array = new Uint8Array();
    ImageMagick.read(MagickColors.White, 1600, 900, (image) => {
      image.addNoise("Gaussian" as any);
      image.quality = 90;
      image.write(format, (data) => {
        source = new Uint8Array(data);
      });
    });
    const thumbnail = await resizeNewspaperImage(source);
    const info = inspectImage(thumbnail);
    if (info.width !== 640 || info.height !== 360) {
      throw new Error(
        `Unexpected thumbnail size: ${JSON.stringify(info)}`,
      );
    }
    if (thumbnail.length >= source.length) {
      throw new Error(
        "Thumbnail did not reduce actual bytes",
      );
    }
  }
});

Deno.test("malformed image bytes fail terminally instead of retrying storage forever", async () => {
  const bytes = new Uint8Array(24);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  new DataView(bytes.buffer).setUint32(16, 1);
  new DataView(bytes.buffer).setUint32(20, 1);
  try {
    await resizeNewspaperImage(bytes);
    throw new Error("Expected decoding to fail");
  } catch (error) {
    if (
      !(error instanceof Error) || !("definitive" in error) ||
      error.definitive !== true
    ) throw new Error("Malformed output did not produce a definitive error");
  }
});
