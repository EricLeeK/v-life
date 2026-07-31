import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { FortunePageHeader } from "@/components/fortune/FortunePageHeader";
import { SaveReadingButton } from "@/components/fortune/SaveReadingButton";
import { MetricStarCard } from "@/components/fortune/StarRow";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLang } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { useFortuneProfile, localDateString } from "@/hooks/useFortune";
import { buildFortuneUserPrompt, requestFortuneReading } from "@/lib/fortune/aiReading";
import { dailyScores } from "@/lib/fortune/scores";
import { SHENGXIAO_LABELS, SHENGXIAO_ORDER } from "@/lib/fortune/shengxiao";
import type { Shengxiao } from "@/lib/fortune/types";
import { buildDailyRuleCopy } from "@/lib/fortune/ruleCopy";

export default function ShengxiaoPage() {
  const { t, lang } = useLang();
  const { toast } = useToast();
  const { profile } = useFortuneProfile();
  const date = localDateString();
  const [animal, setAnimal] = useState<Shengxiao>(profile?.shengxiao || "tiger");
  const [reading, setReading] = useState("");
  const [loading, setLoading] = useState(false);

  const scores = dailyScores({ date, zodiac: profile?.zodiac_sign, shengxiao: animal });
  const rule = buildDailyRuleCopy({
    date,
    scores,
    profile: { birth_date: profile?.birth_date || "2000-01-01", shengxiao: animal },
    lang,
  });

  async function polish() {
    setLoading(true);
    setReading(rule.body);
    const res = await requestFortuneReading(
      buildFortuneUserPrompt({
        kind: "shengxiao",
        lang,
        facts: { date, animal, scores, draft: rule.body },
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
          subtitle={t("可切换属相浏览，不改动档案", "Browse any animal without changing your profile")}
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

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <MetricStarCard label={t("整体", "Overall")} value={scores.overall} />
          <MetricStarCard label={t("爱情", "Love")} value={scores.love} />
          <MetricStarCard label={t("事业", "Career")} value={scores.career} />
          <MetricStarCard label={t("财运", "Wealth")} value={scores.wealth} />
        </div>

        <div className="card-premium p-6">
          <p className="mb-2 text-[12px] font-medium uppercase tracking-wide text-[#8a847a]">
            {lang === "zh" ? `属${SHENGXIAO_LABELS[animal].zh}` : SHENGXIAO_LABELS[animal].en}
          </p>
          <p className="max-w-3xl text-[15px] leading-relaxed text-[#5c564c]">
            {reading || rule.body}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button className="bg-[#1f1a14] hover:bg-[#1f1a14]/90" onClick={() => void polish()} disabled={loading}>
              {loading ? t("生成中…", "Working…") : t("AI 润色", "AI polish")}
            </Button>
            <SaveReadingButton type="shengxiao" payload={{ animal, scores }} reading={reading || rule.body} />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
