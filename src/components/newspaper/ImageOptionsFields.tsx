import { useId } from "react";
import type {
  ImageProvider,
  NewspaperImageOptions,
} from "../../../supabase/functions/_shared/newspaperTypes";
import {
  NEWSPAPER_IMAGE_MODELS,
  newspaperImageModelGroup,
  normalizeNewspaperImageOptions,
} from "../../../supabase/functions/_shared/newspaperImageModels";

export const IMAGE_PROVIDER_LABELS: Record<ImageProvider, string> = {
  grsai: "Grsai",
  openai: "OpenAI 官方",
  gemini: "Gemini 官方",
};

const SIZE_LABELS: Record<string, string> = { auto: "自动", "512": "0.5K" };
const QUALITY_LABELS: Record<string, string> = {
  auto: "自动",
  low: "低",
  medium: "中",
  high: "高",
  xhigh: "超高",
  max: "最高",
};
const RATIO_LABELS: Record<string, string> = { auto: "自动" };

function sizeLabel(size: string) {
  if (SIZE_LABELS[size]) return SIZE_LABELS[size];
  const match = /^(\d+)x(\d+)$/.exec(size);
  if (!match) return size;
  const [w, h] = [Number(match[1]), Number(match[2])];
  const gcd = (a: number, b: number): number => (b ? gcd(b, a % b) : a);
  const d = gcd(w, h);
  const ratio = `${w / d}:${h / d}`;
  const tier = Math.max(w, h) >= 2800 ? "4K" : Math.max(w, h) >= 1800 ? "2K" : "1K";
  return `${w}×${h} · ${ratio.length <= 6 ? ratio : (w / h).toFixed(2)} · ${tier}`;
}

export function ImageOptionsFields(
  { value, onChange, compact = false }: {
    value: NewspaperImageOptions;
    onChange: (v: NewspaperImageOptions) => void;
    compact?: boolean;
  },
) {
  const id = useId();
  const model =
    NEWSPAPER_IMAGE_MODELS.find((m) =>
      m.provider === value.provider && m.id === value.model
    ) || NEWSPAPER_IMAGE_MODELS[0];
  const models = NEWSPAPER_IMAGE_MODELS.filter((m) =>
    m.provider === value.provider && m.available !== false
  );
  const groups = [...new Set(models.map(newspaperImageModelGroup))];
  const showRatio = model.aspect_ratios.length > 1;
  return (
    <div className={compact ? "np-option-grid np-option-grid-compact" : "np-option-grid"}>
      <label className="np-field" htmlFor={`${id}-provider`}>
        图片服务
        <select
          id={`${id}-provider`}
          value={value.provider}
          onChange={(e) =>
            onChange(
              normalizeNewspaperImageOptions({
                provider: e.target.value as ImageProvider,
              }),
            )}
        >
          {(Object.keys(IMAGE_PROVIDER_LABELS) as ImageProvider[]).map((p) => (
            <option key={p} value={p}>{IMAGE_PROVIDER_LABELS[p]}</option>
          ))}
        </select>
      </label>
      <label className="np-field" htmlFor={`${id}-model`}>
        模型
        <select
          id={`${id}-model`}
          value={value.model}
          onChange={(e) =>
            onChange(
              normalizeNewspaperImageOptions({
                provider: value.provider,
                model: e.target.value,
              }),
            )}
        >
          {groups.map((group) => (
            <optgroup key={group} label={group}>
              {models.filter((m) => newspaperImageModelGroup(m) === group).map((
                m,
              ) => <option key={m.id} value={m.id}>{m.label}</option>)}
            </optgroup>
          ))}
        </select>
      </label>
      {showRatio && (
        <label className="np-field" htmlFor={`${id}-aspect_ratio`}>
          画幅比例
          <select
            id={`${id}-aspect_ratio`}
            value={value.aspect_ratio}
            onChange={(e) => onChange({ ...value, aspect_ratio: e.target.value })}
          >
            {model.aspect_ratios.map((v) => (
              <option key={v} value={v}>{RATIO_LABELS[v] ?? v}</option>
            ))}
          </select>
        </label>
      )}
      <label className="np-field" htmlFor={`${id}-size`}>
        {showRatio ? "分辨率" : "尺寸"}
        <select
          id={`${id}-size`}
          value={value.size}
          onChange={(e) => onChange({ ...value, size: e.target.value })}
        >
          {model.sizes.map((v) => (
            <option key={v} value={v}>{sizeLabel(v)}</option>
          ))}
        </select>
      </label>
      {model.qualities.length > 1 && (
        <label className="np-field" htmlFor={`${id}-quality`}>
          质量
          <select
            id={`${id}-quality`}
            value={value.quality}
            onChange={(e) => onChange({ ...value, quality: e.target.value })}
          >
            {model.qualities.map((v) => (
              <option key={v} value={v}>{QUALITY_LABELS[v] ?? v}</option>
            ))}
          </select>
        </label>
      )}
    </div>
  );
}
