import { Link } from "react-router-dom";
import { useLang } from "@/contexts/LanguageContext";
import { AppLayout } from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { ExamCountdown } from "@/components/civil-service/ExamCountdown";
import { DailyPlanList } from "@/components/civil-service/DailyPlanList";
import { CheckinCard } from "@/components/civil-service/CheckinCard";
import { CivilStatsCharts } from "@/components/civil-service/CivilStatsCharts";
import { ReviewQueueCard } from "@/components/civil-service/ReviewQueueCard";
import { SUBJECT_GROUP_LABELS, SUBJECT_GROUPS } from "@/lib/civilServiceSubjects";
import { BookOpen, FileText, MessageSquare, ChevronRight } from "lucide-react";

const GROUP_ICONS = {
  xingce: BookOpen,
  shenlun: FileText,
  mianshi: MessageSquare,
} as const;

const GROUP_COLORS = {
  xingce: "#d17847",
  shenlun: "#5b88b5",
  mianshi: "#8b7bb8",
} as const;

export default function CivilServiceHome() {
  const { t } = useLang();

  return (
    <AppLayout title={t("考公", "Civil Service")}>
      <div className="space-y-4">
        <ExamCountdown />
        <ReviewQueueCard />
        <DailyPlanList />
        <CheckinCard />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {SUBJECT_GROUPS.map((g) => {
            const Icon = GROUP_ICONS[g];
            return (
              <Link key={g} to={`/civil-service/${g}`}>
                <Card className="border-border bg-white hover:border-[#d17847]/40 transition-colors h-full">
                  <CardContent className="p-4 flex items-center gap-3">
                    <div
                      className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${GROUP_COLORS[g]}18` }}
                    >
                      <Icon className="h-5 w-5" style={{ color: GROUP_COLORS[g] }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="heading-font text-base text-foreground">{SUBJECT_GROUP_LABELS[g].zh}</p>
                      <p className="text-[12px] text-muted-foreground">
                        {t("计划 · 错题", "Plans · Wrongs")}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>

        <CivilStatsCharts />
      </div>
    </AppLayout>
  );
}
