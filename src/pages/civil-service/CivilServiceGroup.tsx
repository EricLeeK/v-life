import { Link, useParams, Navigate } from "react-router-dom";
import { useLang } from "@/contexts/LanguageContext";
import { AppLayout } from "@/components/AppLayout";
import { Button } from "@/components/ui/button";
import { GroupPlanList } from "@/components/civil-service/GroupPlanList";
import { WrongAnswerList } from "@/components/civil-service/WrongAnswerList";
import { WrongAnswerStatsPanel } from "@/components/civil-service/WrongAnswerStatsPanel";
import { XingcePaperList } from "@/components/civil-service/XingcePaperList";
import { XingceScoreCharts } from "@/components/civil-service/XingceScoreCharts";
import { SUBJECT_GROUP_LABELS, SUBJECT_TAGS, isSubjectGroup, type SubjectGroup } from "@/lib/civilServiceSubjects";
import { ArrowLeft } from "lucide-react";

export default function CivilServiceGroup() {
  const { t } = useLang();
  const { group } = useParams<{ group: string }>();

  if (!group || !isSubjectGroup(group) || group === "general") {
    return <Navigate to="/civil-service" replace />;
  }

  const subjectGroup = group as Exclude<SubjectGroup, "general">;
  const label = SUBJECT_GROUP_LABELS[subjectGroup].zh;
  const tags = SUBJECT_TAGS[subjectGroup];
  const isXingce = subjectGroup === "xingce";

  return (
    <AppLayout title={label}>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <Button asChild variant="ghost" size="sm" className="text-[#8a847a] -ml-2">
            <Link to="/civil-service">
              <ArrowLeft className="h-4 w-4 mr-1" />
              {t("返回考公", "Back")}
            </Link>
          </Button>
        </div>

        <p className="text-[13px] text-[#8a847a]">
          {tags.join(" · ")}
        </p>

        {isXingce && (
          <>
            <XingcePaperList />
            <XingceScoreCharts />
          </>
        )}
        <GroupPlanList subjectGroup={subjectGroup} />
        <WrongAnswerList subjectGroup={subjectGroup} />
        <WrongAnswerStatsPanel subjectGroup={subjectGroup} />
      </div>
    </AppLayout>
  );
}
