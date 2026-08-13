import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { FortunePageHeader } from "@/components/fortune/FortunePageHeader";
import { SaveReadingButton } from "@/components/fortune/SaveReadingButton";
import { MetricPercentCard } from "@/components/fortune/StarRow";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLang } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { useFortuneProfile, localDateString } from "@/hooks/useFortune";
import { buildFortuneUserPrompt, requestFortuneReading } from "@/lib/fortune/aiReading";
import { getAlmanacForDate } from "@/lib/fortune/almanac";
import { scoresToPercents } from "@/lib/fortune/percentScore";
import { dailyScores, shengxiaoRelationScore } from "@/lib/fortune/scores";
import { SHENGXIAO_LABELS, SHENGXIAO_ORDER } from "@/lib/fortune/shengxiao";
import type { Shengxiao } from "@/lib/fortune/types";
import { buildDailyRuleCopy } from "@/lib/fortune/ruleCopy";
import { dayPillarFromDate } from "@/lib/fortune/bazi";

export default function ShengxiaoPage() {
  const { t, lang } = useLang();
  const { toast } = useToast();
  const { profile } = useFortuneProfile();
  const date = localDateString();
  const [animal, setAnimal] = useState<Shengxiao>(profile?.shengxiao || "tiger");
  const [reading, setReading] = useState("");
  const [loading, setLoading] = useState(false);

  const almanac = getAlmanacForDate(date);
  const pillar = dayPillarFromDate(date);
  const relation = shengxiaoRelationScore(animal, pillar.zhiZh);
  const relationLabel =
    relation < 0
      ? t("与今日日支相冲", "Clashes with today's branch")
      : relation > 0
        ? t("与今日日支六合", "Six-harmony with today's branch")
        : t("与今日日支平和", "Neutral vs today's branch");

  const scores = dailyScores({ date, zodiac: profile?.zodiac_sign, shengxiao: animal });
  const percents = scoresToPercents(scores, `${date}|${animal}`);
  const rule = buildDailyRuleCopy({
    date,
    scores,
    profile: { birth_date: profile?.birth_date || "2000-01-01", shengxiao: animal },
    lang,
    overallPercent: percents.overall,
  });

  async function polish() {
    setLoading(true);
    setReading(rule.body);
    const res = await requestFortuneReading(
      buildFortuneUserPrompt({
        kind: "shengxiao",
        lang,
        facts: {
          date,
          animal,
          percents,
          relation: relationLabel,
          dayPillar: almanac.dayPillar,
          chongsha: almanac.chongsha,
          draft: rule.body,
        },
      }),
    );
    setLoading(false);
    if (res.ok) setReading(res.text);
    else {
      setReading(rule.body);
      toast({ title: t("AI 暂不可用，已显示底稿", "AI unavailable — draft shown"), description: res.error });
    }
  }

  return (
    <AppLayout title={t("生肖运势", "Shengxiao")}>
      <div className="space-y-8">
        <FortunePageHeader
          title={t("生肖运势", "Shengxiao")}
          subtitle={t("按当日日支冲合计算，可切换属相", "Based on today's earthly branch")}
          backLabel={t("返回运势", "Back to Fortune")}
          actions={
            <Select value={animal} onValueChange={(v) => setAnimal(v as Shengxiao)}>
              <SelectTrigger className="w-[200px] bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SHENGXIAO_ORDER.map((s) => (
                  <SelectItem key={s} value={s}>
                    {lang === "zh" ? `属${SHENGXIAO_LABELS[s].zh}` : SHENGXIAO_LABELS[s].en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          }
        />

        <p className="text-[13px] text-muted-foreground">
          {almanac.dayPillar} · {almanac.chongsha} · {relationLabel}
        </p>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricPercentCard label={t("整体", "Overall")} value={percents.overall} />
          <MetricPercentCard label={t("爱情", "Love")} value={percents.love} />
          <MetricPercentCard label={t("事业", "Career")} value={percents.career} />
          <MetricPercentCard label={t("财运", "Wealth")} value={percents.wealth} />
        </div>

        <div className="card-premium p-6">
          <p className="mb-2 text-[12px] font-medium uppercase tracking-wide text-muted-foreground">
            {lang === "zh" ? `属${SHENGXIAO_LABELS[animal].zh}` : SHENGXIAO_LABELS[animal].en}
          </p>
          <p className="max-w-3xl text-[15px] leading-relaxed text-[#5c564c]">
            {reading || rule.body}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button className="bg-[#1f1a14] hover:bg-[#1f1a14]/90" onClick={() => void polish()} disabled={loading}>
              {loading ? t("生成中…", "Working…") : t("AI 润色", "AI polish")}
            </Button>
            <SaveReadingButton type="shengxiao" payload={{ animal, percents, relation }} reading={reading || rule.body} />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
