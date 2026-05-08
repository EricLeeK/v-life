import { useLang } from "@/contexts/LanguageContext";
import { Card, CardContent } from "@/components/ui/card";
import { Target, CheckCircle2, ListChecks } from "lucide-react";

interface Goal {
  is_completed: boolean;
}

export function GoalStats({ goals }: { goals: Goal[] }) {
  const { t } = useLang();

  const total = goals.length;
  const completed = goals.filter((g) => g.is_completed).length;
  const rate = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <div>
      <p className="text-sm font-medium text-[#8a847a] mb-3">{t("目标概览", "Goal Overview")}</p>
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center mb-1.5">
              <div className="h-8 w-8 rounded-lg bg-[#dcead4] flex items-center justify-center">
                <Target className="h-4 w-4 text-[#5b8c44]" />
              </div>
            </div>
            <p className="text-xl font-semibold text-[#1f1a14] font-mono-data">{rate}%</p>
            <p className="text-[11px] text-[#8a847a]">{t("完成率", "Completion")}</p>
            <div className="h-1 bg-[#e4e1d7] rounded-full mt-2 overflow-hidden">
              <div className="h-full rounded-full bg-[#5b8c44]" style={{ width: `${rate}%` }} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center mb-1.5">
              <div className="h-8 w-8 rounded-lg bg-[#e1eaf4] flex items-center justify-center">
                <ListChecks className="h-4 w-4 text-[#5b88b5]" />
              </div>
            </div>
            <p className="text-xl font-semibold text-[#1f1a14] font-mono-data">{total}</p>
            <p className="text-[11px] text-[#8a847a]">{t("全部目标", "Total Goals")}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-3 text-center">
            <div className="flex items-center justify-center mb-1.5">
              <div className="h-8 w-8 rounded-lg bg-[#fce0c8] flex items-center justify-center">
                <CheckCircle2 className="h-4 w-4 text-[#d17847]" />
              </div>
            </div>
            <p className="text-xl font-semibold text-[#1f1a14] font-mono-data">{completed}</p>
            <p className="text-[11px] text-[#8a847a]">{t("已完成", "Completed")}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
