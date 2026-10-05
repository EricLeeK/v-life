import { useState } from "react";
import { Check, Copy, Pencil, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  type NewspaperImageConfig,
  type NewspaperPreferences,
  type NewspaperStyle,
  useNewspaperCommand,
  useNewspaperImageConfig,
  useNewspaperPreferences,
  useNewspaperStyles,
} from "@/hooks/useNewspapers";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { ImageOptionsFields } from "./ImageOptionsFields";
import {
  DEFAULT_NEWSPAPER_IMAGE_OPTIONS,
  DEFAULT_NEWSPAPER_IMAGE_PROMPT,
} from "../../../supabase/functions/_shared/newspaperImageModels";
import type { NewspaperImageOptions } from "../../../supabase/functions/_shared/newspaperTypes";
import { PROVIDER_BASE_URLS } from "../../../supabase/functions/_shared/newspaperImageProviders";

const BASE_URL_LABELS: Record<string, string> = {
  "https://grsai.dakka.com.cn": "国内节点 · grsai.dakka.com.cn",
  "https://grsaiapi.com": "海外节点 · grsaiapi.com",
  "https://api.openai.com": "官方 · api.openai.com",
  "https://generativelanguage.googleapis.com": "官方 · generativelanguage.googleapis.com",
};

function PreferencesForm({ value }: { value: NewspaperPreferences }) {
  const [draft, setDraft] = useState(value);
  const command = useNewspaperCommand();
  return (
    <form
      className="np-settings-block"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await command.mutateAsync({
            action: "preferences_save",
            input: {
              enabled: draft.enabled,
              timezone: draft.timezone,
              day_start_hour: draft.day_start_hour,
            },
          });
          toast.success("日报设置已保存");
        } catch (e) {
          toast.error((e as Error).message);
        }
      }}
    >
      <h3>每天，留下一份生活存档</h3>
      <p className="np-muted">
        启用后按设定的时区和日界线归档。已经收藏的日报保留当时快照；往期缺失日期可手动补建。
      </p>
      <label className="np-check">
        <input
          type="checkbox"
          checked={draft.enabled}
          onChange={(e) => setDraft({ ...draft, enabled: e.target.checked })}
        />自动收藏每天的日报
      </label>
      <div className="np-form-grid">
        <label className="np-field">
          归档时区<input
            value={draft.timezone}
            onChange={(e) => setDraft({ ...draft, timezone: e.target.value })}
            placeholder="Asia/Shanghai"
            required
          />
        </label>
        <label className="np-field">
          一天从几点开始<select
            value={draft.day_start_hour}
            onChange={(e) =>
              setDraft({ ...draft, day_start_hour: Number(e.target.value) })}
          >
            {Array.from(
              { length: 24 },
              (_, n) => (
                <option key={n} value={n}>
                  {String(n).padStart(2, "0")}:00
                </option>
              ),
            )}
          </select>
        </label>
      </div>
      <button
        className="np-button np-button-primary"
        disabled={command.isPending}
      >
        <Save size={16} />
        {command.isPending ? "保存中…" : "保存归档设置"}
      </button>
    </form>
  );
}
function ConfigForm({ value }: { value: NewspaperImageConfig }) {
  const [draft, setDraft] = useState(value);
  const [key, setKey] = useState("");
  const command = useNewspaperCommand();
  const { isDemo } = useDemoMode();
  return (
    <form
      className="np-settings-block"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await command.mutateAsync({
            action: "image_config_save",
            input: {
              provider: draft.provider,
              model: draft.model,
              size: draft.size,
              quality: draft.quality,
              aspect_ratio: draft.aspect_ratio,
              base_url: draft.base_url,
              ...(key ? { api_key: key } : {}),
            },
          });
          setKey("");
          toast.success("图片配置已保存");
        } catch (e) {
          toast.error((e as Error).message);
        }
      }}
    >
      <h3>日报图片服务</h3>
      <p className="np-muted">
        图片单独配置，不影响文字日报。只有点击生成时才调用所选服务。
      </p>
      <ImageOptionsFields
        value={draft}
        onChange={(v) =>
          setDraft({
            ...draft,
            ...v,
            base_url: v.provider !== draft.provider
              ? PROVIDER_BASE_URLS[v.provider][0]
              : draft.base_url,
          })}
      />
      <div className="np-form-grid">
        <label className="np-field">
          服务节点<select
            value={PROVIDER_BASE_URLS[draft.provider].includes(draft.base_url)
              ? draft.base_url
              : PROVIDER_BASE_URLS[draft.provider][0]}
            onChange={(e) => setDraft({ ...draft, base_url: e.target.value })}
          >
            {PROVIDER_BASE_URLS[draft.provider].map((url) => (
              <option key={url} value={url}>
                {BASE_URL_LABELS[url] ?? url}
              </option>
            ))}
          </select>
        </label>
        <label className="np-field">
          API 密钥<input
            type="password"
            autoComplete="new-password"
            value={key}
            placeholder={draft.configured
              ? `已保存 · ${draft.key_hint || "••••"}（留空保留）`
              : "填入该服务的 API 密钥"}
            onChange={(e) => setKey(e.target.value)}
          />
        </label>
      </div>
      <p className="np-muted">
        {isDemo
          ? "演示配置只保留在当前浏览器会话，不调用真实图片服务。"
          : "密钥仅保存在服务端，保存后只显示掩码，不回传原文。"}
      </p>
      <button
        className="np-button np-button-primary"
        disabled={command.isPending}
      >
        <Save size={16} />
        {command.isPending ? "保存中…" : "保存图片配置"}
      </button>
    </form>
  );
}
const emptyStyle = (): NewspaperStyle => ({
  id: "",
  name: "",
  prompt_template: DEFAULT_NEWSPAPER_IMAGE_PROMPT,
  is_default: false,
  provider: null,
  model: null,
  size: null,
  quality: null,
  aspect_ratio: null,
  reference_images: [],
  created_at: "",
  updated_at: "",
});
function StyleEditor(
  { style, onClose }: { style: NewspaperStyle; onClose: () => void },
) {
  const [draft, setDraft] = useState(style);
  const [override, setOverride] = useState(!!style.provider);
  const [options, setOptions] = useState<NewspaperImageOptions>(
    style.provider
      ? {
        provider: style.provider,
        model: style.model!,
        size: style.size || "auto",
        quality: style.quality || "high",
        aspect_ratio: style.aspect_ratio || "auto",
      }
      : DEFAULT_NEWSPAPER_IMAGE_OPTIONS,
  );
  const [uploading, setUploading] = useState(false);
  const command = useNewspaperCommand();
  return (
    <form
      className="np-style-editor"
      onSubmit={async (e) => {
        e.preventDefault();
        try {
          await command.mutateAsync({
            action: "style_save",
            input: {
              ...(draft.id
                ? { id: draft.id, expected_updated_at: draft.updated_at }
                : {}),
              name: draft.name,
              prompt_template: draft.prompt_template,
              is_default: draft.is_default,
              reference_images: draft.reference_images,
              ...(override ? options : {
                provider: null,
                model: null,
                size: null,
                quality: null,
                aspect_ratio: null,
              }),
            },
          });
          toast.success("配图风格已保存");
          onClose();
        } catch (e) {
          toast.error((e as Error).message);
        }
      }}
    >
      <label className="np-field">
        风格名称<input
          autoFocus
          required
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          placeholder="例如：纸上日常"
        />
      </label>
      <label className="np-field">
        提示词模板<textarea
          rows={6}
          required
          value={draft.prompt_template}
          onChange={(e) =>
            setDraft({ ...draft, prompt_template: e.target.value })}
        />
      </label>
      <div className="np-inline">
        <span className="np-muted">插入变量</span>
        {["date", "content", "section"].map((v) => (
          <button
            type="button"
            className="np-text-button"
            key={v}
            onClick={() =>
              setDraft({
                ...draft,
                prompt_template: draft.prompt_template + ` {{${v}}}`,
              })}
          >
            {`{{${v}}}`}
          </button>
        ))}
      </div>
      <label className="np-check">
        <input
          type="checkbox"
          checked={draft.is_default}
          onChange={(e) => setDraft({ ...draft, is_default: e.target.checked })}
        />设为一键生成的默认风格
      </label>
      <label className="np-check">
        <input
          type="checkbox"
          checked={override}
          onChange={(e) => setOverride(e.target.checked)}
        />为这个风格指定模型参数
      </label>
      {override && <ImageOptionsFields value={options} onChange={setOptions} />}
      <label className="np-field">
        参考图（可选）<input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          disabled={uploading}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            if (file.size > 8 * 1024 * 1024) {
              toast.error("请选择小于 8 MB 的参考图");
              return;
            }
            setUploading(true);
            try {
              const base64 = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () =>
                  resolve(String(reader.result).split(",")[1]);
                reader.onerror = reject;
                reader.readAsDataURL(file);
              });
              const result = await command.mutateAsync({
                action: "reference_upload",
                input: { base64, mime: file.type, filename: file.name },
              });
              setDraft((d) => ({
                ...d,
                reference_images: [...d.reference_images, result.path],
              }));
            } catch (e) {
              toast.error((e as Error).message);
            } finally {
              setUploading(false);
            }
          }}
        />
      </label>
      {draft.reference_images.map((ref, i) => (
        <div className="np-inline" key={ref}>
          <span className="np-muted">参考图 {i + 1}</span>
          <button
            type="button"
            className="np-text-button"
            onClick={() =>
              setDraft({
                ...draft,
                reference_images: draft.reference_images.filter((r) =>
                  r !== ref
                ),
              })}
          >
            移除
          </button>
        </div>
      ))}
      <div className="np-inline">
        <button
          className="np-button np-button-primary"
          disabled={command.isPending || uploading}
        >
          <Save size={16} />保存风格
        </button>
        <button type="button" className="np-button" onClick={onClose}>
          取消
        </button>
      </div>
    </form>
  );
}
export function NewspaperSettings() {
  const preferences = useNewspaperPreferences();
  const config = useNewspaperImageConfig();
  const styles = useNewspaperStyles();
  const command = useNewspaperCommand();
  const [editing, setEditing] = useState<NewspaperStyle | null>(null);
  return (
    <div className="np-scope np-settings">
      <h2 className="heading-font text-xl font-semibold">生活日报</h2>
      {preferences.isLoading && <p role="status">正在读取日报设置…</p>}
      {preferences.error && (
        <p className="np-error" role="alert">
          {preferences.error.message}
          <button
            className="np-text-button"
            onClick={() => preferences.refetch()}
          >
            重新加载
          </button>
        </p>
      )}
      {preferences.data && (
        <PreferencesForm
          key={JSON.stringify(preferences.data)}
          value={preferences.data}
        />
      )}
      {config.data && (
        <ConfigForm key={JSON.stringify(config.data)} value={config.data} />
      )}
      {config.error && (
        <p className="np-error">图片配置加载失败：{config.error.message}</p>
      )}
      <section className="np-settings-block">
        <div className="np-split">
          <div>
            <h3>我的配图风格</h3>
            <p className="np-muted">将喜欢的风格留下，以后直接使用。</p>
          </div>
          <button
            className="np-button"
            onClick={() => setEditing(emptyStyle())}
          >
            <Plus size={16} />新建风格
          </button>
        </div>
        {styles.error && <p className="np-error">{styles.error.message}</p>}
        {!styles.isLoading && !styles.data?.length && (
          <p className="np-muted">
            还没有自定义风格。一键生成将使用内置编辑插画模板。
          </p>
        )}
        {styles.data?.map((style) => (
          <div className="np-style-row" key={style.id}>
            <div>
              <strong>{style.name}</strong>
              {style.is_default && (
                <span className="np-status">
                  <Check size={12} />默认
                </span>
              )}
              <p className="np-muted np-line-clamp">{style.prompt_template}</p>
            </div>
            <div className="np-inline">
              <button
                aria-label={`编辑${style.name}`}
                className="np-icon-button"
                onClick={() =>
                  setEditing(style)}
              >
                <Pencil size={16} />
              </button>
              <button
                aria-label={`复制${style.name}`}
                className="np-icon-button"
                onClick={() =>
                  setEditing({
                    ...style,
                    id: "",
                    name: `${style.name} 副本`,
                    is_default: false,
                  })}
              >
                <Copy size={16} />
              </button>
              <button
                aria-label={`删除${style.name}`}
                className="np-icon-button"
                onClick={async () => {
                  if (
                    !window.confirm(
                      `删除风格“${style.name}”？历史图片仍会保留。`,
                    )
                  ) {
                    return;
                  }
                  try {
                    await command.mutateAsync({
                      action: "style_delete",
                      input: { id: style.id },
                    });
                    toast.success("风格已删除");
                  } catch (e) {
                    toast.error((e as Error).message);
                  }
                }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
        {editing && (
          <StyleEditor
            key={editing.id || "new"}
            style={editing}
            onClose={() => setEditing(null)}
          />
        )}
      </section>
    </div>
  );
}
