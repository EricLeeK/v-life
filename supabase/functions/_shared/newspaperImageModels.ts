import {
  type ImageProvider,
  NewspaperError,
  type NewspaperImageOptions,
} from "./newspaperTypes.ts";

export interface NewspaperImageModel {
  provider: ImageProvider;
  id: string;
  label: string;
  sizes: string[];
  qualities: string[];
  aspect_ratios: string[];
  reference_limit: number;
  available: boolean;
}
const ratios = [
  "auto",
  "1:1",
  "16:9",
  "9:16",
  "4:3",
  "3:4",
  "3:2",
  "2:3",
  "5:4",
  "4:5",
  "21:9",
];
const gpt = [
  "auto",
  "1024x1024",
  "1672x941",
  "941x1672",
  "1443x1090",
  "1090x1443",
  "1536x1024",
  "1024x1536",
  "1408x1120",
  "1120x1408",
  "1920x832",
  "832x1920",
  "896x1792",
  "1792x896",
];
const vip = [
  "auto",
  "1024x1024",
  "1280x720",
  "720x1280",
  "1152x864",
  "864x1152",
  "1536x1024",
  "1024x1536",
  "1120x896",
  "896x1120",
  "1456x624",
  "624x1456",
  "1536x768",
  "768x1536",
  "2048x2048",
  "2048x1152",
  "1152x2048",
  "2304x1728",
  "1728x2304",
  "2048x1360",
  "1360x2048",
  "2240x1792",
  "1792x2240",
  "2912x1248",
  "1248x2912",
  "3072x1536",
  "1536x3072",
  "2880x2880",
  "3840x2160",
  "2160x3840",
  "3264x2448",
  "2448x3264",
  "3504x2336",
  "2336x3504",
  "3200x2560",
  "2560x3200",
  "3840x1648",
  "1648x3840",
  "3840x1920",
  "1920x3840",
];
function validOfficialSize(size: string): boolean {
  if (size === "auto") return true;
  if (!/^\d+x\d+$/.test(size)) return false;
  const [w, h] = size.split("x").map(Number);
  return w % 16 === 0 && h % 16 === 0 && w <= 3840 && h <= 3840 &&
    Math.max(w, h) / Math.min(w, h) <= 3 && w * h >= 655360 && w * h <= 8294400;
}
const officialSizes = [
  ...new Set([...vip, "1536x864", "3072x2048", "2048x3072"]),
].filter(validOfficialSize);
const quality = ["auto", "low", "medium", "high"];
const entry = (
  provider: ImageProvider,
  id: string,
  sizes: string[],
  qualities = quality,
  aspect_ratios = ["auto"],
  reference_limit = 8,
): NewspaperImageModel => ({
  provider,
  id,
  label: id,
  sizes,
  qualities,
  aspect_ratios,
  reference_limit,
  // Current channel availability, confirmed by the owner; retain all capability definitions for history.
  available: provider !== 'grsai' || id === 'gpt-image-2-vip',
});
/** Grsai options mirror grsai-studio's current HTML/JS controls. Official matrices are intentionally separate. */
export const NEWSPAPER_IMAGE_MODELS: NewspaperImageModel[] = [
  ...[
    "nano-banana",
    "nano-banana-fast",
    "nano-banana-2",
    "nano-banana-2-cl",
    "nano-banana-2-4k-cl",
    "nano-banana-pro",
    "nano-banana-pro-cl",
    "nano-banana-pro-vip",
    "nano-banana-pro-4k-vip",
  ].map((id) =>
    entry("grsai", id, ["auto", "1K", "2K", "4K"], quality, ratios)
  ),
  entry("grsai", "gpt-image-2", gpt),
  entry("grsai", "gpt-image-2-vip", vip),
  entry("grsai", "gpt-image-2.5-flare", vip, ["low", "medium", "high"]),
  entry("grsai", "gpt-image-2.5-sunburst", vip, [
    "low",
    "medium",
    "high",
    "xhigh",
    "max",
  ]),
  ...["gpt-image-2", "gpt-image-2.5-flare", "gpt-image-2.5-sunburst"].map(
    (id) =>
      entry(
        "openai",
        id,
        officialSizes,
        id === "gpt-image-2" ? quality : [...quality, "xhigh", "max"],
      ),
  ),
  entry(
    "gemini",
    "gemini-3.1-flash-image",
    ["auto", "512", "1K", "2K", "4K"],
    ["auto"],
    [...ratios, "1:4", "4:1", "1:8", "8:1"],
    14,
  ),
  entry(
    "gemini",
    "gemini-3-pro-image",
    ["auto", "1K", "2K", "4K"],
    ["auto"],
    ratios,
    14,
  ),
];
export const DEFAULT_NEWSPAPER_IMAGE_OPTIONS: NewspaperImageOptions = {
  provider: "grsai",
  model: "gpt-image-2-vip",
  size: "auto",
  quality: "high",
  aspect_ratio: "auto",
};
export const DEFAULT_NEWSPAPER_IMAGE_PROMPT =
  "为 {{date}} 的生活日报创作一幅温暖、克制、有留白的编辑插画。栏目：{{section}}。只以以下记录为灵感，不虚构成就，不在图中添加未经确认的事实或长篇文字。\n{{content}}";
export function normalizeNewspaperImageOptions(
  input: Partial<NewspaperImageOptions> = {},
  fallback: Partial<NewspaperImageOptions> = {},
): NewspaperImageOptions {
  const provider = input.provider ?? fallback.provider ?? "grsai";
  const model = input.model ??
    (fallback.provider === provider ? fallback.model : undefined) ??
    ({
      grsai: "gpt-image-2-vip",
      openai: "gpt-image-2",
      gemini: "gemini-3.1-flash-image",
    } as const)[provider];
  const found = NEWSPAPER_IMAGE_MODELS.find((x) =>
    x.provider === provider && x.id === model
  );
  if (!found) {
    throw new NewspaperError("INVALID_INPUT", "不支持的图片供应商或模型。");
  }
  const same = (!fallback.provider || fallback.provider === provider) &&
    (!fallback.model || fallback.model === model);
  const result = {
    provider,
    model,
    size: input.size ?? (same ? fallback.size : undefined) ?? "auto",
    quality: input.quality ?? (same ? fallback.quality : undefined) ??
      (provider === "gemini" ? "auto" : "high"),
    aspect_ratio: input.aspect_ratio ??
      (same ? fallback.aspect_ratio : undefined) ?? "auto",
  };
  for (
    const [key, allowed] of [["size", found.sizes], [
      "quality",
      found.qualities,
    ], ["aspect_ratio", found.aspect_ratios]] as const
  ) {
    if (
      !allowed.includes(result[key]) &&
      !(provider === "openai" && key === "size" &&
        validOfficialSize(result.size))
    ) throw new NewspaperError("INVALID_INPUT", `模型不支持该${key}参数。`);
  }
  return result;
}
export function renderNewspaperImagePrompt(
  template: string,
  values: { date: string; content: string; section: string },
): string {
  if (
    typeof template !== "string" || !template.trim() || template.length > 16000
  ) throw new NewspaperError("INVALID_INPUT", "提示词需为 1–16000 字。");
  if (
    [...template.matchAll(/\{\{([^{}]*)\}\}/g)].some((m) =>
      !["date", "content", "section"].includes(m[1])
    )
  ) {
    throw new NewspaperError(
      "INVALID_INPUT",
      "仅支持 {{date}}、{{content}}、{{section}} 占位符。",
    );
  }
  const prompt = template.replace(
    /\{\{(date|content|section)\}\}/g,
    (_, key) => values[key as keyof typeof values],
  );
  if (prompt.length > 48000) {
    throw new NewspaperError("INVALID_INPUT", "日报内容过长，请选择单独栏目。");
  }
  return prompt;
}

/** Shared by prompt preview and submission; values are substituted once, never evaluated again. */
export function composeNewspaperImagePrompt(
  template: string,
  report: {
    date: string;
    snapshot: { sections: Array<{ id: string; title: string; items: Array<{ title: string; body: string; status: string; time?: string; date?: string }> }> };
    supplements: Array<{ body: string; occurred_at?: string | null }>;
  },
  sectionId = 'main',
): string {
  const sections = report.snapshot.sections.filter(section => sectionId === 'main' || section.id === sectionId);
  const blocks = sections.map(section => `${section.title}\n${section.items.map(item =>
    `${item.title}（${item.status === 'completed' ? '已完成' : item.status === 'planned' ? '计划' : '记录'}）\n${item.body}`
  ).join('\n\n')}`);
  if ((sectionId === 'main' || sectionId === 'thoughts') && report.supplements.length) {
    blocks.push(`手动补记\n${report.supplements.map(item => item.body).join('\n\n')}`);
  }
  return renderNewspaperImagePrompt(template, {
    date: report.date, section: sectionId === 'main' ? '整期主图' : sections[0]?.title || sectionId,
    content: blocks.join('\n\n'),
  });
}
