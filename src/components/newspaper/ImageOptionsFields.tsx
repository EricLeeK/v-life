import { useId } from "react";
import type {
  ImageProvider,
  NewspaperImageOptions,
} from "../../../supabase/functions/_shared/newspaperTypes";
import {
  NEWSPAPER_IMAGE_MODELS,
  normalizeNewspaperImageOptions,
} from "../../../supabase/functions/_shared/newspaperImageModels";
export function ImageOptionsFields(
  { value, onChange }: {
    value: NewspaperImageOptions;
    onChange: (v: NewspaperImageOptions) => void;
  },
) {
  const id = useId();
  const model =
    NEWSPAPER_IMAGE_MODELS.find((m) =>
      m.provider === value.provider && m.id === value.model
    ) || NEWSPAPER_IMAGE_MODELS[0];
  const select = (
    key: string,
    label: string,
    values: string[],
    change: (v: string) => void,
  ) => (
    <label className="np-field" htmlFor={`${id}-${key}`}>
      {label}
      <select
        id={`${id}-${key}`}
        value={value[key as keyof NewspaperImageOptions]}
        onChange={(e) => change(e.target.value)}
      >
        {values.map((v) => <option key={v} value={v}>{v}</option>)}
      </select>
    </label>
  );
  return (
    <div className="np-form-grid">
      {select(
        "provider",
        "图片服务",
        ["grsai", "openai", "gemini"],
        (provider) =>
          onChange(
            normalizeNewspaperImageOptions({
              provider: provider as ImageProvider,
            }),
          ),
      )}
      {select(
        "model",
        "模型",
        NEWSPAPER_IMAGE_MODELS.filter((m) =>
          m.provider === value.provider && m.available !== false
        ).map(
          (m) => m.id,
        ),
        (model) =>
          onChange(
            normalizeNewspaperImageOptions({ provider: value.provider, model }),
          ),
      )}
      {select(
        "size",
        "图片尺寸",
        model.sizes,
        (size) => onChange({ ...value, size }),
      )}
      {select(
        "quality",
        "质量",
        model.qualities,
        (quality) => onChange({ ...value, quality }),
      )}
      {select(
        "aspect_ratio",
        "画幅比例",
        model.aspect_ratios,
        (aspect_ratio) => onChange({ ...value, aspect_ratio }),
      )}
    </div>
  );
}
