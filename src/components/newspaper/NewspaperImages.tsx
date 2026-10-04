import { useNewspaperDrafts } from "./NewspaperDraftContext";
import { useEffect, useMemo, useState } from "react";
import { Check, Download, ImagePlus, Maximize2, Minimize2 } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import {
  callNewspaper,
  useNewspaperCommand,
  useNewspaperImageConfig,
  useNewspaperStyles,
} from "@/hooks/useNewspapers";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { ImageOptionsFields, IMAGE_PROVIDER_LABELS } from "./ImageOptionsFields";
import { NewspaperSheet } from "./NewspaperSheet";
import {
  composeNewspaperImagePrompt,
  DEFAULT_NEWSPAPER_IMAGE_OPTIONS,
  DEFAULT_NEWSPAPER_IMAGE_PROMPT,
  NEWSPAPER_IMAGE_MODELS,
  normalizeNewspaperImageOptions,
} from "../../../supabase/functions/_shared/newspaperImageModels";
import type {
  NewspaperImageAsset,
  NewspaperImageJob,
  NewspaperImageOptions,
  NewspaperReport,
  NewspaperSectionId,
} from "../../../supabase/functions/_shared/newspaperTypes";
import { saveBlob } from "@/lib/newspaperExport";

export type ImagePlacement = NewspaperSectionId | "main";

export const PLACEMENT_LABELS: Record<ImagePlacement, string> = {
  main: "头版",
  chronicle: "今日纪事",
  learning: "学习与成长",
  finance: "收支记录",
  health: "身体与饮食",
  thoughts: "想法与随笔",
};

export function placementLabel(report: NewspaperReport, p: ImagePlacement) {
  if (p === "main") return PLACEMENT_LABELS.main;
  return report.snapshot.sections.find((s) => s.id === p)?.title ?? PLACEMENT_LABELS[p];
}

const ACTIVE_JOB = ["queued", "submitting", "running", "saving"];
export const isRunningJob = (j: NewspaperImageJob) =>
  ACTIVE_JOB.includes(j.status);

/** Polls while any job is in flight, so finished art lands on the page without the studio open. */
export function useImageJobPolling(report: NewspaperReport) {
  const { isDemo } = useDemoMode();
  const qc = useQueryClient();
  const running = report.jobs.filter(isRunningJob).length;
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      void callNewspaper("image_status", { date: report.date }, isDemo).then(
        () => qc.invalidateQueries({ queryKey: ["newspaper"] }),
      ).catch(() => {});
    }, 4000);
    return () => clearInterval(timer);
  }, [running, report.date, isDemo, qc]);
}

export function NewspaperFigure(
  { asset, onOpen, lead = false }: {
    asset: NewspaperImageAsset;
    onOpen: (a: NewspaperImageAsset) => void;
    lead?: boolean;
  },
) {
  const ratio = asset.width && asset.height
    ? `${asset.width} / ${asset.height}`
    : undefined;
  const portrait = !lead && asset.height > asset.width * 1.1;
  return (
    <figure
      className={lead
        ? "np-figure np-figure-lead"
        : portrait
        ? "np-figure np-figure-portrait"
        : "np-figure"}
    >
      <button
        type="button"
        className="np-figure-frame"
        aria-label={`查看配图：${asset.caption || "日报配图"}`}
        onClick={() => onOpen(asset)}
        style={{ aspectRatio: ratio }}
      >
        {asset.url
          ? (
            <img
              src={asset.thumbnail_url && !lead ? asset.thumbnail_url : asset.url}
              alt={asset.caption || "日报配图"}
              loading={lead ? "eager" : "lazy"}
            />
          )
          : <span className="np-figure-missing">图片链接已过期，重新打开日报即可恢复。</span>}
      </button>
      <figcaption>
        <span>{asset.caption || "未填写图注"}</span>
        <span className="np-figure-credit">图 · {modelLabel(asset.options)}</span>
      </figcaption>
    </figure>
  );
}

function modelLabel(options: NewspaperImageOptions) {
  return NEWSPAPER_IMAGE_MODELS.find((m) =>
    m.provider === options.provider && m.id === options.model
  )?.label ?? options.model;
}

/** A reserved slot in the layout while a picture is being drawn for it. */
export function FigurePlaceholder(
  { job, lead = false }: { job: NewspaperImageJob; lead?: boolean },
) {
  return (
    <div
      className={lead ? "np-figure-pending np-figure-lead" : "np-figure-pending"}
      role="status"
    >
      <span className="np-figure-pending-sheen" aria-hidden />
      <p>
        {job.status === "saving" ? "正在冲印配图" : "正在绘制配图"}
        <small>可以继续阅读，完成后会自动排进版面</small>
      </p>
    </div>
  );
}

export function NewspaperImageLightbox(
  { asset, onClose }: {
    asset: NewspaperImageAsset | null;
    onClose: () => void;
  },
) {
  const [actual, setActual] = useState(false);
  return (
    <DialogPrimitive.Root
      open={!!asset}
      onOpenChange={(open) => {
        if (!open) {
          setActual(false);
          onClose();
        }
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="np-lightbox-backdrop" />
        <DialogPrimitive.Content className="np-lightbox">
          <div className={actual ? "np-lightbox-stage np-lightbox-actual" : "np-lightbox-stage"}>
            <img
              src={asset?.url}
              alt={asset?.caption || "日报配图"}
              width={asset?.width}
              height={asset?.height}
            />
          </div>
          <div className="np-lightbox-bar">
            <div className="np-lightbox-text">
              <DialogPrimitive.Title>{asset?.caption || "日报配图"}</DialogPrimitive.Title>
              <DialogPrimitive.Description>
                {asset && `${PLACEMENT_LABELS[asset.section_id as ImagePlacement] ?? ""} · ${asset.width}×${asset.height} · ${modelLabel(asset.options)}`}
              </DialogPrimitive.Description>
            </div>
            <div className="np-inline">
              <button
                type="button"
                className="np-lightbox-button"
                onClick={() => setActual(!actual)}
              >
                {actual ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                {actual ? "适合窗口" : "原始大小"}
              </button>
              <button
                type="button"
                className="np-lightbox-button"
                onClick={async () => {
                  if (!asset?.url) return;
                  try {
                    const response = await fetch(asset.url);
                    if (!response.ok) throw new Error("图片下载失败");
                    const blob = await response.blob();
                    const ext = blob.type.includes("png")
                      ? "png"
                      : blob.type.includes("webp")
                      ? "webp"
                      : "jpg";
                    saveBlob(blob, `${asset.report_date}-${asset.section_id}.${ext}`);
                  } catch (e) {
                    toast.error((e as Error).message);
                  }
                }}
              >
                <Download size={16} />下载
              </button>
              <DialogPrimitive.Close className="np-lightbox-button" aria-label="关闭">
                <X size={18} />
              </DialogPrimitive.Close>
            </div>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

export function ImageStudio(
  { report, open, onOpenChange, placement, onPlacement, onOpenAsset }: {
    report: NewspaperReport;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    placement: ImagePlacement;
    onPlacement: (p: ImagePlacement) => void;
    onOpenAsset: (a: NewspaperImageAsset) => void;
  },
) {
  const drafts = useNewspaperDrafts();
  const [styleId, setStyleId] = useState("");
  const [prompt, setPrompt] = useState<string | null>(null);
  const [options, setOptions] = useState<NewspaperImageOptions | null>(null);
  const styles = useNewspaperStyles();
  const config = useNewspaperImageConfig();
  const command = useNewspaperCommand();
  const { isDemo } = useDemoMode();
  const placements = useMemo<ImagePlacement[]>(() => [
    "main",
    ...report.snapshot.sections.filter((s) => s.items.length).map((s) => s.id),
  ], [report.snapshot.sections]);
  const style = styles.data?.find((s) => s.id === styleId) ||
    (styleId ? undefined : styles.data?.find((s) => s.is_default));
  let inherited = config.data || DEFAULT_NEWSPAPER_IMAGE_OPTIONS;
  try {
    if (style?.provider) {
      inherited = normalizeNewspaperImageOptions({
        provider: style.provider,
        model: style.model ?? undefined,
        size: style.size ?? undefined,
        quality: style.quality ?? undefined,
        aspect_ratio: style.aspect_ratio ?? undefined,
      }, inherited);
    }
  } catch {
    /* An outdated saved style falls back to the account default. */
  }
  const chosen = options || inherited;
  let preview = "";
  try {
    preview = composeNewspaperImagePrompt(
      style?.prompt_template || DEFAULT_NEWSPAPER_IMAGE_PROMPT,
      report,
      placement,
    );
  } catch (e) {
    preview = (e as Error).message;
  }
  const busyHere = report.jobs.some((j) =>
    j.section_id === placement && (isRunningJob(j) || j.status === "unknown")
  );
  const needsKey = !isDemo && !config.data?.configured;
  const providerMismatch = !isDemo && config.data?.configured &&
    chosen.provider !== config.data.provider;
  const candidates = report.assets.filter((a) => a.section_id === placement);
  const jobs = report.jobs.filter((j) => j.section_id === placement);

  async function generate() {
    try {
      if (!await drafts.flush()) {
        throw new Error("请先保存补充原文，再生成配图。");
      }
      if (!report.id) {
        await command.mutateAsync({ action: "refresh", input: { date: report.date } });
      }
      await command.mutateAsync({
        action: "image_generate",
        input: {
          date: report.date,
          section_id: placement,
          ...(styleId ? { style_id: styleId } : {}),
          ...(prompt !== null ? { prompt } : {}),
          ...(options ? { options } : {}),
        },
      });
      toast.success(
        isDemo ? "演示配图已排进版面" : "已开始绘制，完成后会自动排进版面",
      );
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <NewspaperSheet
      open={open}
      onOpenChange={onOpenChange}
      title="为这期日报配图"
      description={isDemo
        ? "演示模式只生成版面示例，不调用真实图片服务。"
        : "文字本身已是完整的日报，配图按需生成。每张候选都会保留，可随时换回。"}
      footer={
        <button
          type="button"
          className="np-button np-button-primary np-button-block"
          disabled={command.isPending || busyHere || needsKey}
          onClick={() => void generate()}
        >
          <ImagePlus size={16} />
          {busyHere ? "这个位置正在绘制…" : `生成${placementLabel(report, placement)}配图`}
        </button>
      }
    >
      {needsKey && (
        <p className="np-callout">
          还没有可用的图片服务。到
          <Link className="np-text-link" to="/settings#settings-newspaper">设置 · 生活日报</Link>
          保存 Grsai、OpenAI 或 Gemini 的密钥后即可生成。
        </p>
      )}
      <fieldset className="np-sheet-group">
        <legend>放在哪里</legend>
        <div className="np-choice-row">
          {placements.map((p) => {
            const count = report.assets.filter((a) => a.section_id === p).length;
            return (
              <button
                type="button"
                key={p}
                className="np-choice"
                aria-pressed={placement === p}
                onClick={() => {
                  onPlacement(p);
                  setPrompt(null);
                }}
              >
                {placementLabel(report, p)}
                {count > 0 && <small>{count}</small>}
              </button>
            );
          })}
        </div>
      </fieldset>
      <fieldset className="np-sheet-group">
        <legend>画风</legend>
        <div className="np-choice-row">
          <button
            type="button"
            className="np-choice"
            aria-pressed={!styleId}
            onClick={() => {
              setStyleId("");
              setPrompt(null);
            }}
          >
            {styles.data?.find((s) => s.is_default)?.name || "默认画风"}
          </button>
          {styles.data?.filter((s) => !s.is_default).map((s) => (
            <button
              type="button"
              key={s.id}
              className="np-choice"
              aria-pressed={styleId === s.id}
              onClick={() => {
                setStyleId(s.id);
                setPrompt(null);
              }}
            >
              {s.name}
            </button>
          ))}
          <Link className="np-text-link" to="/settings#settings-newspaper">管理画风</Link>
        </div>
      </fieldset>
      <details className="np-sheet-details">
        <summary>
          <span>模型与参数</span>
          <span className="np-summary-value">
            {IMAGE_PROVIDER_LABELS[chosen.provider]} · {modelLabel(chosen)}
          </span>
        </summary>
        <ImageOptionsFields value={chosen} onChange={setOptions} compact />
        {providerMismatch && (
          <p className="np-muted">
            当前保存的是 {IMAGE_PROVIDER_LABELS[config.data!.provider]} 的密钥；换用其他服务前，请先在设置中保存它的密钥。
          </p>
        )}
        {options && (
          <button type="button" className="np-text-link" onClick={() => setOptions(null)}>
            恢复为默认参数
          </button>
        )}
      </details>
      <details className="np-sheet-details">
        <summary>
          <span>提示词</span>
          <span className="np-summary-value">{prompt === null ? "按画风自动生成" : "已手动修改"}</span>
        </summary>
        <label className="np-field">
          <span className="sr-only">最终提示词</span>
          <textarea
            rows={9}
            value={prompt ?? preview}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </label>
        <p className="np-muted">只影响这一次生成，不会改动画风模板。</p>
        {prompt !== null && (
          <button type="button" className="np-text-link" onClick={() => setPrompt(null)}>
            还原自动提示词
          </button>
        )}
      </details>
      {jobs.filter((j) => j.status === "unknown").map((j) => (
        <p className="np-callout" key={j.id}>
          这次生成的结果尚待确认，服务商可能已经接收；为避免重复扣费不会自动重交。
          <button
            type="button"
            className="np-text-link"
            onClick={async () => {
              try {
                await command.mutateAsync({ action: "image_status", input: { id: j.id } });
              } catch (e) {
                toast.error((e as Error).message);
              }
            }}
          >
            检查状态
          </button>
        </p>
      ))}
      {jobs.filter((j) => j.status === "failed").slice(0, 1).map((j) => (
        <p className="np-error" key={j.id}>
          上一次没有画成：{j.error || "请检查配置后再试一次。"}
        </p>
      ))}
      <section className="np-sheet-group" aria-label="候选配图">
        <h3 className="np-sheet-heading">
          {placementLabel(report, placement)}候选
          <span>{candidates.length ? `${candidates.length} 张` : "还没有"}</span>
        </h3>
        {candidates.length
          ? (
            <ul className="np-candidates">
              {candidates.map((asset) => (
                <li key={asset.id} className={asset.active ? "np-candidate-active" : undefined}>
                  <button
                    type="button"
                    className="np-candidate-thumb"
                    onClick={() => onOpenAsset(asset)}
                    aria-label={`查看候选：${asset.caption || "配图"}`}
                  >
                    <img src={asset.thumbnail_url || asset.url} alt="" loading="lazy" />
                  </button>
                  <div className="np-candidate-body">
                    <input
                      aria-label="图注"
                      className="np-caption-input"
                      key={`${asset.id}-${asset.caption}`}
                      defaultValue={asset.caption}
                      placeholder="写一句图注"
                      onBlur={async (e) => {
                        if (e.target.value === asset.caption) return;
                        try {
                          await command.mutateAsync({
                            action: "image_caption",
                            input: { date: report.date, id: asset.id, caption: e.target.value },
                          });
                          toast.success("图注已保存");
                        } catch (err) {
                          toast.error((err as Error).message);
                        }
                      }}
                    />
                    <div className="np-candidate-meta">
                      <span>{modelLabel(asset.options)}</span>
                      {asset.active
                        ? <span className="np-candidate-using"><Check size={13} />版面中</span>
                        : (
                          <button
                            type="button"
                            className="np-text-link"
                            disabled={command.isPending}
                            onClick={async () => {
                              try {
                                await command.mutateAsync({
                                  action: "image_select",
                                  input: { date: report.date, id: asset.id },
                                });
                              } catch (err) {
                                toast.error((err as Error).message);
                              }
                            }}
                          >
                            用这张
                          </button>
                        )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )
          : <p className="np-muted">生成后会出现在这里，并自动排进版面。</p>}
      </section>
    </NewspaperSheet>
  );
}
