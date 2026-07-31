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
import { ZODIAC_LABELS, ZODIAC_SIGNS } from "@/lib/fortune/zodiac";
import type { ZodiacSign } from "@/lib/fortune/types";
import { buildDailyRuleCopy } from "@/lib/fortune/ruleCopy";

export default function ZodiacPage() {
  const { t, lang } = useLang();
  const { toast } = useToast();
  const { profile } = useFortuneProfile();
  const date = localDateString();
  const [sign, setSign] = useState<ZodiacSign>(profile?.zodiac_sign || "virgo");
  const [reading, setReading] = useState("");
  const [loading, setLoading] = useState(false);

  const scores = dailyScores({ date, zodiac: sign, shengxiao: profile?.shengxiao });
  const rule = buildDailyRuleCopy({
    date,
    scores,
    profile: { birth_date: profile?.birth_date || "2000-01-01", zodiac_sign: sign },
    lang,
  });

  async function polish() {
    setLoading(true);
    setReading(rule.body);
    const res = await requestFortuneReading(
      buildFortuneUserPrompt({
        kind: "zodiac",
        lang,
        facts: { date, sign, scores, draft: rule.body },
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
    <AppLayout title={t("星座详解", "Zodiac")}>
      <div className="space-y-8">
        <FortunePageHeader
          title={t("星座详解", "Zodiac")}
          subtitle={t("可切换星座浏览，不改动档案", "Browse any sign without changing your profile")}
          backLabel={t("返回运势", "Back to Fortune")}
          actions={
            <Select value={sign} onValueChange={(v) => setSign(v as ZodiacSign)}>
              <SelectTrigger className="w-[200px] bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ZODIAC_SIGNS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {lang === "zh" ? ZODIAC_LABELS[s].zh : ZODIAC_LABELS[s].en}
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
            {lang === "zh" ? ZODIAC_LABELS[sign].zh : ZODIAC_LABELS[sign].en}
          </p>
          <p className="max-w-3xl text-[15px] leading-relaxed text-[#5c564c]">
            {reading || rule.body}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Button className="bg-[#1f1a14] hover:bg-[#1f1a14]/90" onClick={() => void polish()} disabled={loading}>
              {loading ? t("生成中…", "Working…") : t("AI 润色", "AI polish")}
            </Button>
            <SaveReadingButton type="zodiac" payload={{ sign, scores }} reading={reading || rule.body} />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
