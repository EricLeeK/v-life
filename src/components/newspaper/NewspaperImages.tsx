import { useNewspaperDrafts } from "./NewspaperDraftContext";
import { useEffect, useState } from "react";
import {
  Check,
  Download,
  ImagePlus,
  RefreshCw,
  SlidersHorizontal,
  ZoomIn,
} from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./NewspaperDialog";
import {
  callNewspaper,
  useNewspaperCommand,
  useNewspaperImageConfig,
  useNewspaperStyles,
} from "@/hooks/useNewspapers";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { ImageOptionsFields } from "./ImageOptionsFields";
import {
  composeNewspaperImagePrompt,
  DEFAULT_NEWSPAPER_IMAGE_OPTIONS,
  DEFAULT_NEWSPAPER_IMAGE_PROMPT,
  normalizeNewspaperImageOptions,
} from "../../../supabase/functions/_shared/newspaperImageModels";
import type {
  NewspaperImageAsset,
  NewspaperImageOptions,
  NewspaperReport,
  NewspaperSectionId,
} from "../../../supabase/functions/_shared/newspaperTypes";
import { saveBlob } from "@/lib/newspaperExport";

export function NewspaperFigure(
  { asset, onOpen }: {
    asset: NewspaperImageAsset;
    onOpen: (a: NewspaperImageAsset) => void;
  },
) {
  return (
    <figure
      className={`np-figure ${
        asset.section_id === "main" ? "np-main-figure" : ""
      }`}
    >
      <button
        className="np-image-open"
        aria-label={`放大配图：${asset.caption || "日报配图"}`}
        onClick={() => onOpen(asset)}
      >
        {asset.url
          ? (
            <img
              src={asset.url}
              alt={asset.caption || "日报配图"}
              loading="lazy"
            />
          )
          : (
            <div className="np-empty-note">
              图片链接暂不可用，请重新打开日报。
            </div>
          )}
        <span>
          <ZoomIn size={16} />查看原图
        </span>
      </button>
      <figcaption>{asset.caption || "未填写图注"}</figcaption>
    </figure>
  );
}
export function NewspaperImageLightbox(
  { asset, onClose }: {
    asset: NewspaperImageAsset | null;
    onClose: () => void;
  },
) {
  const [zoom, setZoom] = useState(false);
  return (
    <Dialog
      open={!!asset}
      onOpenChange={(open) => {
        if (!open) {
          setZoom(false);
          onClose();
        }
      }}
    >
      <DialogContent className="np-image-dialog max-w-[95vw] max-h-[95vh] overflow-auto">
        <DialogTitle>{asset?.caption || "日报配图"}</DialogTitle>
        <DialogDescription>
          {asset?.width} × {asset?.height} · {asset?.options.model} ·{" "}
          {asset?.created_at ? new Date(asset.created_at).toLocaleString() : ""}
        </DialogDescription>
        <div className="np-lightbox-image">
          <img
            src={asset?.url}
            alt={asset?.caption || "日报配图"}
            style={{
              maxHeight: zoom ? "none" : "70vh",
              maxWidth: zoom ? "none" : "100%",
              width: zoom ? `${asset?.width}px` : "auto",
            }}
          />
        </div>
        <div className="np-inline">
          <button className="np-button" onClick={() => setZoom(!zoom)}>
            <ZoomIn size={16} />
            {zoom ? "适合窗口" : "原始大小"}
          </button>
          <button
            className="np-button"
            onClick={async () => {
              if (!asset?.url) return;
              try {
                const response = await fetch(asset.url);
                if (!response.ok) throw new Error("图片下载失败");
                const blob = await response.blob();
                const ext = blob.type.includes("svg")
                  ? "svg"
                  : blob.type.includes("png")
                  ? "png"
                  : blob.type.includes("webp")
                  ? "webp"
                  : "jpg";
                saveBlob(
                  blob,
                  `${asset.report_date}-${asset.section_id}.${ext}`,
                );
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            <Download size={16} />下载图片
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
const labels: Record<string, string> = {
  main: "整期主图",
  chronicle: "今日纪事",
  learning: "学习手记",
  finance: "生活账本",
  health: "身体与日常",
  thoughts: "留给自己的话",
};
export function NewspaperImages(
  { report, onOpen, requestedSection }: {
    report: NewspaperReport;
    onOpen: (a: NewspaperImageAsset) => void;
    requestedSection?: { id: NewspaperSectionId; nonce: number };
  },
) {
  const drafts = useNewspaperDrafts();
  const [expanded, setExpanded] = useState(false);
  const [section, setSection] = useState<NewspaperSectionId | "main">("main");
  const [styleId, setStyleId] = useState("");
  const [prompt, setPrompt] = useState<string | null>(null);
  const [options, setOptions] = useState<NewspaperImageOptions | null>(null);
  const styles = useNewspaperStyles();
  const config = useNewspaperImageConfig();
  const command = useNewspaperCommand();
  const { isDemo } = useDemoMode();
  const qc = useQueryClient();
  const style = styles.data?.find((s) => s.id === styleId) ||
    (styleId ? "" : styles.data?.find((s) => s.is_default));
  let inheritedOptions = config.data || DEFAULT_NEWSPAPER_IMAGE_OPTIONS;
  try {
    if (style) {
      inheritedOptions = normalizeNewspaperImageOptions({
        provider: style.provider ?? undefined,
        model: style.model ?? undefined,
        size: style.size ?? undefined,
        quality: style.quality ?? undefined,
        aspect_ratio: style.aspect_ratio ?? undefined,
      }, inheritedOptions);
    }
  } catch {
    /* Existing settings will surface a validation error on generation. */
  }
  const chosenOptions = options || inheritedOptions;
  let preview = "";
  try {
    preview = composeNewspaperImagePrompt(
      (style && style.prompt_template) || DEFAULT_NEWSPAPER_IMAGE_PROMPT,
      report,
      section,
    );
  } catch (e) {
    preview = (e as Error).message;
  }
  useEffect(() => {
    if (requestedSection) {
      setSection(requestedSection.id);
      setExpanded(true);
      setPrompt(null);
    }
  }, [requestedSection]);
  const running = report.jobs.filter((j) =>
    ["queued", "submitting", "running", "saving"].includes(j.status)
  );
  const uncertain = report.jobs.filter((j) => j.status === "unknown");
  useEffect(() => {
    if (!running.length) return;
    const timer = setInterval(() => {
      void callNewspaper("image_status", { date: report.date }, isDemo).then(
        () => qc.invalidateQueries({ queryKey: ["newspaper"] }),
      ).catch(() => {});
    }, 4000);
    return () => clearInterval(timer);
  }, [running.length, report.date, isDemo, qc]);
  async function generate(custom = false) {
    try {
      if (!await drafts.flush()) {
        throw new Error("请先保存补充原文，再生成配图。");
      }
      if (!report.id) {
        await command.mutateAsync({
          action: "refresh",
          input: { date: report.date },
        });
      }
      const input = {
        date: report.date,
        section_id: custom ? section : "main",
        ...(custom && styleId ? { style_id: styleId } : {}),
        ...(custom && prompt !== null ? { prompt } : {}),
        ...(custom && options ? { options } : {}),
      };
      await command.mutateAsync({ action: "image_generate", input });
      toast.success(
        isDemo ? "演示配图已就绪" : "图片任务已提交，完成后会自动显示",
      );
    } catch (e) {
      toast.error((e as Error).message);
    }
  }
  return (
    <section
      id="np-image-controls"
      className="np-image-controls"
      aria-label="日报配图"
    >
      <div className="np-split">
        <div>
          <h2>为这一天配一幅图</h2>
          <p className="np-muted">
            文字已经是一份完整的日报。配图按需生成，历史候选会保留。
          </p>
        </div>
        <div className="np-inline">
          <button
            className="np-button np-button-primary"
            disabled={command.isPending ||
              running.some((j) => j.section_id === "main") ||
              uncertain.some((j) => j.section_id === "main") ||
              (!isDemo && !config.data?.configured)}
            onClick={() => void generate()}
          >
            <ImagePlus size={16} />
            {running.some((j) => j.section_id === "main")
              ? "主图生成中…"
              : "一键生成主图"}
          </button>
          <button
            className="np-icon-button"
            aria-label="配置本次配图"
            aria-expanded={expanded}
            onClick={() => setExpanded(!expanded)}
          >
            <SlidersHorizontal size={18} />
          </button>
        </div>
      </div>
      {!isDemo && !config.data?.configured && (
        <p className="np-muted">
          先到{" "}
          <Link className="np-text-button" to="/settings#settings-newspaper">
            日报设置
          </Link>{" "}
          保存图片服务与密钥。
        </p>
      )}
      {isDemo && (
        <p className="np-muted">
          演示模式：生成的是版面示例，不调用真实 AI 服务。
        </p>
      )}
      {expanded && (
        <div className="np-image-config">
          <div className="np-form-grid">
            <label className="np-field">
              配图位置<select
                value={section}
                onChange={(e) => {
                  setSection(e.target.value as typeof section);
                  setPrompt(null);
                }}
              >
                {Object.entries(labels).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </label>
            <label className="np-field">
              配图风格<select
                value={styleId}
                onChange={(e) => {
                  setStyleId(e.target.value);
                  setPrompt(null);
                }}
              >
                <option value="">使用默认风格</option>
                {styles.data?.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </label>
          </div>
          <details>
            <summary>本次模型参数</summary>
            <ImageOptionsFields value={chosenOptions} onChange={setOptions} />
            <p className="np-muted">仅影响这次生成。供应商须已保存对应密钥。</p>
          </details>
          <label className="np-field">
            最终提示词（本次临时编辑，不改变风格模板）<textarea
              rows={7}
              value={prompt ?? preview}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </label>
          <div className="np-inline">
            <button
              className="np-button np-button-primary"
              disabled={command.isPending || running.some((j) =>
                j.section_id === section
              ) || uncertain.some((j) => j.section_id === section) ||
                (!isDemo && !config.data?.configured)}
              onClick={() => void generate(true)}
            >
              生成{labels[section]}
            </button>
            <button
              className="np-text-button"
              onClick={() => {
                setOptions(null);
                setPrompt(null);
              }}
            >
              还原默认参数
            </button>
            <Link to="/settings#settings-newspaper" className="np-text-button">
              管理风格
            </Link>
          </div>
        </div>
      )}
      {running.map((j) => (
        <p className="np-job" key={j.id} role="status">
          <RefreshCw size={14} className="animate-spin" />
          {labels[j.section_id]}：{j.status === "saving"
            ? "正在保存图片"
            : "正在生成"}，离开页面后仍可回来查看。
        </p>
      ))}
      {uncertain.map((j) => (
        <p className="np-job np-error" key={j.id}>
          这次生成的结果尚待确认，可能已被服务商接收。不会自动重新提交。<button
            className="np-text-button"
            onClick={async () => {
              try {
                await command.mutateAsync({
                  action: "image_status",
                  input: { id: j.id },
                });
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            检查状态
          </button>
        </p>
      ))}
      {report.jobs.filter((j) => j.status === "failed").slice(0, 2).map((j) => (
        <p className="np-error" key={j.id}>
          配图未完成：{j.error || "请检查配置后手动重试。"}
        </p>
      ))}
      {!!report.assets.length && (
        <details className="np-gallery">
          <summary>图片候选与图注 · {report.assets.length} 张</summary>
          <div className="np-gallery-grid">
            {report.assets.map((asset) => (
              <div key={asset.id}>
                <button
                  className="np-gallery-thumb"
                  onClick={() => onOpen(asset)}
                  aria-label={`查看${labels[asset.section_id]}候选图`}
                >
                  <img
                    src={asset.thumbnail_url || asset.url}
                    alt={asset.caption || "配图候选"}
                    loading="lazy"
                  />
                </button>
                <div className="np-split">
                  <span className="np-muted">{labels[asset.section_id]}</span>
                  <button
                    className="np-text-button"
                    disabled={asset.active || command.isPending}
                    onClick={async () => {
                      try {
                        await command.mutateAsync({
                          action: "image_select",
                          input: { date: report.date, id: asset.id },
                        });
                      } catch (e) {
                        toast.error((e as Error).message);
                      }
                    }}
                  >
                    {asset.active
                      ? (
                        <>
                          <Check size={13} />正在使用
                        </>
                      )
                      : "使用这张"}
                  </button>
                </div>
                <label className="np-field">
                  图注<input
                    key={`${asset.id}-${asset.caption}`}
                    defaultValue={asset.caption}
                    onBlur={async (e) => {
                      if (e.target.value === asset.caption) return;
                      try {
                        await command.mutateAsync({
                          action: "image_caption",
                          input: {
                            date: report.date,
                            id: asset.id,
                            caption: e.target.value,
                          },
                        });
                        toast.success("图注已保存");
                      } catch (e) {
                        toast.error((e as Error).message);
                      }
                    }}
                  />
                </label>
                <details>
                  <summary>生成记录</summary>
                  <p className="np-muted">
                    {asset.options.provider} / {asset.options.model} ·{" "}
                    {asset.options.size} · {asset.options.quality}
                  </p>
                  <p className="np-original">{asset.prompt}</p>
                </details>
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
