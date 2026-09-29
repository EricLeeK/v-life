import type {
  NewspaperReport,
  NewspaperSectionId,
} from "../../supabase/functions/_shared/newspaperTypes";
import { exportNewspaperMarkdown } from "../../supabase/functions/_shared/newspaperDomain";
export interface NewspaperExportOptions {
  rawOnly?: boolean;
  sections?: NewspaperSectionId[];
}
export function newspaperMarkdown(
  report: NewspaperReport,
  options: NewspaperExportOptions = {},
) {
  const filtered = options.sections
    ? {
      ...report,
      snapshot: {
        ...report.snapshot,
        sections: report.snapshot.sections.filter((s) =>
          options.sections!.includes(s.id)
        ),
      },
    }
    : report;
  return exportNewspaperMarkdown(filtered, {
    includeSupplements: true,
    includeReview: !options.rawOnly,
  });
}
const encode = (s: string) => new TextEncoder().encode(s);
function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
/** STORE-mode ZIP: UTF-8 filenames, CRC32, central directory; no dependency or remote links. */
function zipFiles(files: Array<{ name: string; bytes: Uint8Array }>) {
  const chunks: Uint8Array[] = [];
  const directory: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = encode(file.name);
    const crc = crc32(file.bytes);
    const header = new Uint8Array(30 + name.length);
    const h = new DataView(header.buffer);
    h.setUint32(0, 0x04034b50, true);
    h.setUint16(4, 20, true);
    h.setUint16(6, 0x800, true);
    h.setUint32(14, crc, true);
    h.setUint32(18, file.bytes.length, true);
    h.setUint32(22, file.bytes.length, true);
    h.setUint16(26, name.length, true);
    header.set(name, 30);
    chunks.push(header, file.bytes);
    const central = new Uint8Array(46 + name.length);
    const c = new DataView(central.buffer);
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x800, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, file.bytes.length, true);
    c.setUint32(24, file.bytes.length, true);
    c.setUint16(28, name.length, true);
    c.setUint32(42, offset, true);
    central.set(name, 46);
    directory.push(central);
    offset += header.length + file.bytes.length;
  }
  const directorySize = directory.reduce((n, b) => n + b.length, 0);
  const end = new Uint8Array(22);
  const e = new DataView(end.buffer);
  e.setUint32(0, 0x06054b50, true);
  e.setUint16(8, files.length, true);
  e.setUint16(10, files.length, true);
  e.setUint32(12, directorySize, true);
  e.setUint32(16, offset, true);
  const result = new Uint8Array(offset + directorySize + 22);
  let position = 0;
  for (const chunk of [...chunks, ...directory, end]) {
    result.set(chunk, position);
    position += chunk.length;
  }
  return result;
}
export async function buildPortableNewspaper(
  report: NewspaperReport,
  options: NewspaperExportOptions = {},
  fetcher: typeof fetch = fetch,
): Promise<Uint8Array> {
  const files: Array<{ name: string; bytes: Uint8Array }> = [];
  let markdown = newspaperMarkdown(report, options);
  const assets = report.assets.filter((a) =>
    !options.sections || a.section_id === "main" ||
    options.sections.includes(a.section_id)
  );
  for (const [index, asset] of assets.entries()) {
    if (!asset.url) {
      throw new Error("有配图链接尚未加载，请重新打开日报后导出。");
    }
    const response = await fetcher(asset.url);
    if (!response.ok) {
      throw new Error("配图下载失败，未生成不完整的压缩包。请刷新后重试。");
    }
    const mime = response.headers.get("content-type") || "";
    const ext = mime.includes("svg")
      ? "svg"
      : mime.includes("png")
      ? "png"
      : mime.includes("webp")
      ? "webp"
      : "jpg";
    const name = `images/${
      String(index + 1).padStart(2, "0")
    }-${asset.section_id}.${ext}`;
    files.push({ name, bytes: new Uint8Array(await response.arrayBuffer()) });
    markdown += `\n\n![${asset.caption.replace(/[\[\]\n]/g, " ")}](${name})\n`;
  }
  files.unshift({ name: "newspaper.md", bytes: encode(markdown) });
  return zipFiles(files);
}
export function saveBlob(
  bytes: Uint8Array | Blob,
  name: string,
  mime = "application/zip",
) {
  const blob = bytes instanceof Blob
    ? bytes
    : new Blob([bytes as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
