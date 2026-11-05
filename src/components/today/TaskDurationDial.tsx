import { useRef, useState } from "react";
import { useLang } from "@/contexts/LanguageContext";
import { TASK_DURATION_STOPS } from "@/lib/todayTaskModel";

interface TaskDurationDialProps {
  value: number;
  onChange: (value: number) => void;
}

function formatDuration(value: number, lang: "zh" | "en") {
  if (value < 60) return lang === "zh" ? `${value} 分钟` : `${value} minutes`;
  const hours = value / 60;
  const label = Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
  return lang === "zh" ? `${label} 小时` : `${label} hours`;
}

function nearestStopIndex(event: React.PointerEvent<HTMLDivElement>, element: HTMLDivElement): number {
  const rect = element.getBoundingClientRect();
  const x = event.clientX - (rect.left + rect.width / 2);
  const y = event.clientY - (rect.top + rect.height / 2);
  const angle = (Math.atan2(y, x) + Math.PI / 2 + 2 * Math.PI) % (2 * Math.PI);
  return Math.round((angle / (2 * Math.PI)) * TASK_DURATION_STOPS.length) % TASK_DURATION_STOPS.length;
}

export function TaskDurationDial({ value, onChange }: TaskDurationDialProps) {
  const { lang, t } = useLang();
  const faceRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const selectedIndex = TASK_DURATION_STOPS.reduce((best, stop, index) =>
    Math.abs(stop - value) < Math.abs(TASK_DURATION_STOPS[best] - value) ? index : best, 0);

  const updateFromPointer = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!faceRef.current) return;
    onChange(TASK_DURATION_STOPS[nearestStopIndex(event, faceRef.current)]);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const directions: Record<string, number> = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 };
    if (event.key in directions) {
      event.preventDefault();
      const next = Math.max(0, Math.min(TASK_DURATION_STOPS.length - 1, selectedIndex + directions[event.key]));
      onChange(TASK_DURATION_STOPS[next]);
    } else if (event.key === "Home") {
      event.preventDefault();
      onChange(TASK_DURATION_STOPS[0]);
    } else if (event.key === "End") {
      event.preventDefault();
      onChange(TASK_DURATION_STOPS[TASK_DURATION_STOPS.length - 1]);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <div
        ref={faceRef}
        role="slider"
        aria-label={t("预计时长", "Estimated duration")}
        aria-valuemin={TASK_DURATION_STOPS[0]}
        aria-valuemax={TASK_DURATION_STOPS[TASK_DURATION_STOPS.length - 1]}
        aria-valuenow={value}
        aria-valuetext={formatDuration(value, lang)}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture?.(event.pointerId);
          setDragging(true);
          updateFromPointer(event);
        }}
        onPointerMove={(event) => { if (dragging) updateFromPointer(event); }}
        onPointerUp={() => setDragging(false)}
        onPointerCancel={() => setDragging(false)}
        className="relative h-56 w-56 touch-none select-none rounded-full border border-border bg-[radial-gradient(circle_at_center,hsl(var(--card))_0_34%,transparent_34.5%),repeating-conic-gradient(from_-20deg,hsl(var(--border))_0deg_1deg,transparent_1deg_40deg),hsl(var(--muted)/.24)] shadow-inner outline-none focus-visible:ring-2 focus-visible:ring-ring"
        data-value={value}
      >
        {TASK_DURATION_STOPS.map((stop, index) => {
          const angle = (index / TASK_DURATION_STOPS.length) * 2 * Math.PI - Math.PI / 2;
          const selected = index === selectedIndex;
          return (
            <span
              key={stop}
              aria-hidden="true"
              className={`absolute flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[11px] font-medium tabular-nums transition-colors ${selected ? "bg-[hsl(var(--cat-orange))] text-white shadow-md" : "bg-card text-muted-foreground"}`}
              style={{ left: `${50 + Math.cos(angle) * 42}%`, top: `${50 + Math.sin(angle) * 42}%` }}
            >
              {stop}
            </span>
          );
        })}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono-data text-3xl font-semibold text-foreground">{value}</span>
          <span className="text-xs text-muted-foreground">{t("分钟", "minutes")}</span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">{t("拖动或点按钟面调整，最长 4 小时", "Drag or tap the dial · up to 4 hours")}</p>
    </div>
  );
}
