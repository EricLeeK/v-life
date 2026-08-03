import { useLang } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useDueCivilWrongAnswers, useReviewCivilWrongAnswer } from "@/hooks/useCivilService";
import { useToast } from "@/hooks/use-toast";
import { BookMarked, CheckCircle2, RotateCcw } from "lucide-react";

export function ReviewQueueCard() {
  const { t } = useLang();
  const { toast } = useToast();
  const { data: due = [] } = useDueCivilWrongAnswers();
  const review = useReviewCivilWrongAnswer();

  return (
    <Card className="border-[#e4e1d7] bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-base heading-font flex items-center gap-2">
          <BookMarked className="h-4 w-4 text-[#d17847]" />
          {t("今日待复习", "Due today")}
          <span className="ml-1 text-[13px] font-normal text-[#8a847a] font-mono-data">{due.length}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {due.length === 0 && (
          <p className="text-[13px] text-[#8a847a] text-center py-4">
            {t("今天没有到期错题", "No wrong answers due today")}
          </p>
        )}
        {due.map((item) => (
          <div key={item.id} className="rounded-lg border border-[#e4e1d7] p-3 flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-medium text-[#1f1a14] truncate">{item.title}</p>
              <p className="text-[11px] text-[#8a847a] mt-0.5">
                {item.subject_tag || item.subject_group}
                {item.knowledge_point ? ` · ${item.knowledge_point}` : ""}
                {" · "}
                {t("间隔", "Interval")} {item.review_interval_days || 1}{t("天", "d")}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-[12px] border-[#e4e1d7]"
                onClick={async () => {
                  await review.markReviewed(item);
                  toast({ title: t("已复习，下次后推", "Reviewed, next date advanced") });
                }}
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                {t("已复习", "Reviewed")}
              </Button>
              <Button
                size="sm"
                className="h-8 text-[12px] bg-[#5b8c44] hover:bg-[#4a7538] text-white"
                onClick={async () => {
                  await review.markMastered(item);
                  toast({ title: t("已掌握", "Mastered") });
                }}
              >
                <CheckCircle2 className="h-3 w-3 mr-1" />
                {t("掌握", "Done")}
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
