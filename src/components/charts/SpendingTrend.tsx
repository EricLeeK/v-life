import { Fragment, useLayoutEffect, useId, useMemo, useRef, useState, type PointerEvent } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import { Heading } from "@/components/ui/typography";
import { TrendLine } from "@/components/arc/ShareCharts";
import { useLang } from "@/contexts/LanguageContext";
import styles from "./spending-trend.module.css";

const limits = [100, 150, 200, 300, 500, 1000, 5000, Infinity];
const last = limits.length - 1;
type Expense = { id: string; date: string; name: string; amount_cny: string | number };
const displayLimit = (index: number) => index === last ? "∞" : String(limits[index]);

function initialStop(records: Expense[]) {
  if (records.length < 3) return last;
  const sorted = records.map(row => Number(row.amount_cny)).sort((a, b) => a - b);
  const typical = sorted[Math.min(sorted.length - 2, Math.ceil(sorted.length * .9) - 1)];
  return sorted[sorted.length - 1] > typical * 4 ? limits.findIndex(n => n >= typical) : last;
}

export function SpendingTrend({ records, label, onScrub }: {
  records: Expense[];
  label?: string;
  onScrub: (value: { value: number; label: string } | null) => void;
}) {
  const { t } = useLang();
  const auto = useMemo(() => initialStop(records), [records]);
  const [manual, setManual] = useState<number | null>(null);
  const index = manual ?? auto;
  const limit = limits[index];
  const { data, excluded } = useMemo(() => {
    const totals = new Map<string, number>();
    const excluded: Expense[] = [];
    for (const row of records) {
      const value = Number(row.amount_cny);
      if (value > limit) excluded.push(row);
      totals.set(row.date, (totals.get(row.date) ?? 0) + (value > limit ? 0 : value));
    }
    const data = [...totals].sort(([a], [b]) => a.localeCompare(b)).map(([date, sum]) => ({
      key: date, label: date.replaceAll("-", "/"), axisLabel: date.slice(5).replace("-", "/"),
      values: { spending: Number(sum.toFixed(2)) },
    }));
    return { data, excluded: excluded.sort((a, b) => Number(b.amount_cny) - Number(a.amount_cny)) };
  }, [records, limit]);
  const plot = useRef<HTMLDivElement>(null);
  const [plotHeight, setPlotHeight] = useState(220);
  useLayoutEffect(() => {
    const node = plot.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      // The chart reserves another 26px below its plot for date labels.
      setPlotHeight(Math.max(220, node.clientHeight - 26));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return <>
    <div className="mb-2 flex items-center justify-between gap-2">
      <Heading as="h2" className="text-sm font-medium">{t("每日支出趋势", "Daily spending trend")}</Heading>
      <ExcludedExpenses records={excluded} limit={limit} />
    </div>
    <div className={styles.body}>
      <div ref={plot} className={styles.plot}><TrendLine data={data} series={[{ key: "spending", label: label ?? t("支出", "Spending"), color: "hsl(var(--cat-orange))", area: true }]}
        label={t("每日支出趋势", "Daily spending trend")} unit="CNY" height={plotHeight} legend={false}
        formatValue={value => `¥${value.toFixed(2)}`} formatTick={value => `¥${value.toFixed(0)}`}
        emptyLabel={t("所选范围暂无数据", "No spending in this range")} categoryLabel={t("日期", "Date")}
        onActiveChange={(_, datum) => onScrub(datum && typeof datum.values.spending === "number"
          ? { value: datum.values.spending, label: datum.label } : null)} /></div>
      <LimitDial key={auto} index={index} onChange={setManual} />
    </div>
  </>;
}

function LimitDial({ index, onChange }: { index: number; onChange: (index: number) => void }) {
  const { t } = useLang();
  const reduced = useReducedMotion();
  const position = useMotionValue(index);
  const bottom = useTransform(position, n => `${Math.min(last, Math.max(0, n)) / last * 100}%`);
  const lane = useRef<HTMLDivElement>(null);
  const pointer = useRef<number | null>(null);
  const lastMove = useRef(0);
  function settle(stop: number) {
    const velocity = performance.now() - lastMove.current < 80 ? position.getVelocity() : 0;
    onChange(stop);
    if (reduced) position.jump(stop);
    else animate(position, stop, { type: "spring", stiffness: 500, damping: 14, velocity: Math.max(-12, Math.min(12, velocity)) });
  }
  function drag(event: PointerEvent) {
    if (pointer.current !== event.pointerId || !lane.current) return;
    const rect = lane.current.getBoundingClientRect();
    const raw = Math.max(0, Math.min(last, (rect.bottom - event.clientY) / rect.height * last));
    const stop = Math.round(raw);
    const offset = raw - stop;
    position.set(stop + offset * (.18 + .82 * (Math.abs(offset) * 2) ** 1.6));
    lastMove.current = performance.now();
    onChange(stop);
  }
  function release(event: PointerEvent) {
    if (pointer.current !== event.pointerId) return;
    pointer.current = null;
    settle(Math.round(position.get()));
  }
  return <div className={styles.control}>
    <span>{t("高消费阈值", "High-spend threshold")}</span>
    <strong>{Number.isFinite(limits[index]) ? "¥" : ""}{displayLimit(index)}</strong>
    <div className={styles.dial} role="slider" tabIndex={0} aria-label={t("高消费阈值", "High-spend threshold")}
      aria-orientation="vertical" aria-valuemin={0} aria-valuemax={last} aria-valuenow={index}
      aria-valuetext={index === last ? t("不限", "Unlimited") : `¥${limits[index]}`}
      onPointerDown={event => {
        if (event.button !== 0 || pointer.current !== null) return;
        position.stop();
        event.currentTarget.focus();
        event.currentTarget.setPointerCapture(event.pointerId);
        pointer.current = event.pointerId;
        drag(event);
      }} onPointerMove={drag} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={release}
      onKeyDown={event => {
        const next: Record<string, number> = { ArrowUp: index + 1, ArrowRight: index + 1, ArrowDown: index - 1, ArrowLeft: index - 1, Home: 0, End: last };
        if (!(event.key in next)) return;
        event.preventDefault();
        settle(Math.min(last, Math.max(0, next[event.key])));
      }}>
      <div ref={lane} className={styles.lane}>
        <motion.i className={styles.fill} style={{ height: bottom }} />
        {limits.map((_, i) => <Fragment key={i}>
          <i className={styles.dot} data-filled={i <= index} style={{ bottom: `${i / last * 100}%` }} />
          <span className={styles.tick} data-selected={i === index} style={{ bottom: `${i / last * 100}%` }}>{displayLimit(i)}</span>
        </Fragment>)}
        <motion.i className={styles.thumb} style={{ bottom }} />
      </div>
    </div>
  </div>;
}

function ExcludedExpenses({ records, limit }: { records: Expense[]; limit: number }) {
  const { t } = useLang();
  const reduced = useReducedMotion();
  const title = useId();
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const morph = useRef<Animation | null>(null);
  function open() {
    const panel = dialog.current!;
    if (panel.open) return;
    const from = trigger.current!.getBoundingClientRect();
    panel.showModal();
    const to = panel.getBoundingClientRect();
    const dx = from.left + from.width / 2 - to.left - to.width / 2;
    const dy = from.top + from.height / 2 - to.top - to.height / 2;
    if (!reduced) morph.current = panel.animate([
      { transform: `translate(${dx}px,${dy}px) scale(${from.width / to.width},${from.height / to.height})`, opacity: .65 },
      { transform: "none", opacity: 1 },
    ], { duration: 440, easing: "cubic-bezier(.21,.88,.25,1.04)", fill: "both" });
  }
  function closeAndRestoreFocus() {
    dialog.current?.close();
    trigger.current?.focus({ preventScroll: true });
  }
  function dismiss() {
    const animation = morph.current;
    if (!animation) { closeAndRestoreFocus(); return; }
    if (animation.playbackRate < 0) return;
    animation.reverse();
    animation.updatePlaybackRate(-1.35);
    animation.finished.then(() => {
      closeAndRestoreFocus();
      animation.cancel();
      morph.current = null;
    }).catch(() => {});
  }
  return <div className="flex shrink-0 justify-end">
    <button ref={trigger} data-restore-dialog-focus type="button" disabled={!records.length} className="rounded-full bg-secondary px-3 py-1 text-xs text-muted-foreground disabled:opacity-60" onClick={open}>
      {t(`高消费 ${records.length} 笔`, `High spending · ${records.length}`)} ›
    </button>
    <dialog ref={dialog} className={styles.dialog} aria-labelledby={title}
      onCancel={event => { event.preventDefault(); dismiss(); }}
      onClick={event => {
        const r = event.currentTarget.getBoundingClientRect();
        if (event.target === event.currentTarget && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)) dismiss();
      }}>
      <div className="flex items-center justify-between gap-2">
        <h3 id={title} className="font-semibold">{t("高消费明细", "High spending details")}</h3>
        <button type="button" className="p-2 text-xs" onClick={dismiss}>{t("关闭", "Close")}</button>
      </div>
      <p className="mb-3 text-xs text-muted-foreground">{t("单笔超过", "Above")} ¥{limit} · {t("合计", "Total")} ¥{records.reduce((sum, r) => sum + Number(r.amount_cny), 0).toFixed(2)}</p>
      <ul>{records.map(r => <li key={r.id} className="flex justify-between gap-3 border-t py-2">
        <div className="min-w-0 break-words">{r.name}<small className="block text-muted-foreground">{r.date}</small></div>
        <b className="shrink-0 tabular-nums">¥{Number(r.amount_cny).toFixed(2)}</b>
      </li>)}</ul>
    </dialog>
  </div>;
}
