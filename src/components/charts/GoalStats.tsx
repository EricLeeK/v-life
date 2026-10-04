import { useLang } from "@/contexts/LanguageContext";

interface Goal {
  is_completed: boolean;
}

export function GoalStats({ goals }: { goals: Goal[] }) {
  const { t } = useLang();

  const total = goals.length;
  const completed = goals.filter((g) => g.is_completed).length;
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <section aria-label={t("目标概览", "Goal Overview")}>
      <dl className="grid grid-cols-3 border-y border-border divide-x divide-border">
        <div className="px-4 py-3 first:pl-1">
          <dt className="text-xs text-muted-foreground">{t("完成率", "Completion")}</dt>
          <dd className="mt-1 text-2xl font-semibold text-foreground font-mono-data">{rate}%</dd>
          <div className="mt-2 h-[3px] max-w-[10rem] bg-muted" aria-hidden>
            <div className="h-full bg-foreground/70" style={{ width: `${rate}%` }} />
          </div>
        </div>
        <div className="px-4 py-3">
          <dt className="text-xs text-muted-foreground">{t("全部目标", "Total Goals")}</dt>
          <dd className="mt-1 text-2xl font-semibold text-foreground font-mono-data">{total}</dd>
        </div>
        <div className="px-4 py-3">
          <dt className="text-xs text-muted-foreground">{t("已完成", "Completed")}</dt>
          <dd className="mt-1 text-2xl font-semibold text-foreground font-mono-data">{completed}</dd>
        </div>
      </dl>
    </section>
  );
}
