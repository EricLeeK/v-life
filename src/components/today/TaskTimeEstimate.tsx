import { Clock3 } from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";
import { formatTaskDuration, hasTaskDuration } from "@/lib/todayTaskModel";

export function TaskTimeEstimate({ minutes }: { minutes?: number | null }) {
  const { t, lang } = useLang();
  const known = hasTaskDuration(minutes);
  const label = known ? formatTaskDuration(minutes, lang) : t("未设置用时", "No estimate");
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground"
      aria-label={known ? t(`预计用时 ${label}`, `Estimated time ${label}`) : label}
    >
      <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
      <span className={known ? "tabular-nums" : undefined}>{label}</span>
    </span>
  );
}
