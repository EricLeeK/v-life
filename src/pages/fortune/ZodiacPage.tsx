import { useEffect, useState } from "react";
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
import { fetchHoroscope, zodiacFactorFromStars, type HoroscopeDay } from "@/lib/fortune/horoscope";
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
  const [horoscope, setHoroscope] = useState<HoroscopeDay | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingHoro, setLoadingHoro] = useState(false);
  const [reading, setReading] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoadingHoro(true);
    setLoadError(null);
    setHoroscope(null);
    setReading("");
    void fetchHoroscope(sign).then((res) => {
      if (cancelled) return;
      setLoadingHoro(false);
      if (res.ok) setHoroscope(res.data);
      else {
        setLoadError(res.error);
        toast({
          title: t("星座日运暂不可用", "Daily horoscope unavailable"),
          description: res.error,
          variant: "destructive",
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [sign]);

  const scores = horoscope?.stars
    ?? dailyScores({
      date,
      zodiac: sign,
      shengxiao: profile?.shengxiao,
      zodiacFactor: null,
    });
  const rule = buildDailyRuleCopy({
    date,
    scores,
    profile: { birth_date: profile?.birth_date || "2000-01-01", zodiac_sign: sign },
    lang,
  });
  const body = reading || horoscope?.text || (loadError ? rule.body : rule.body);

  async function polish() {
    setLoading(true);
    setReading(horoscope?.text || rule.body);
    const res = await requestFortuneReading(
      buildFortuneUserPrompt({
        kind: "zodiac",
        lang,
        facts: {
          date,
          sign,
          scores,
          horoscope: horoscope?.text,
          source: horoscope?.source,
          draft: horoscope?.text || rule.body,
          zodiacFactor: horoscope ? zodiacFactorFromStars(horoscope.stars.overall) : undefined,
        },
      }),
    );
    setLoading(false);
    if (res.ok) setReading(res.text);
    else {
      setReading(horoscope?.text || rule.body);
      toast({ title: t("AI 暂不可用，已显示日运原文", "AI unavailable — raw horoscope shown"), description: res.error });
    }
  }

  return (
    <AppLayout title={t("星座详解", "Zodiac")}>
      <div className="space-y-8">
        <FortunePageHeader
          title={t("星座详解", "Zodiac")}
          subtitle={t("网上日运（按星座），可切换浏览", "Live daily horoscope by sign")}
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
            {loadingHoro ? (lang === "zh" ? " · 拉取中…" : " · Loading…") : ""}
          </p>
          {loadError && !horoscope && (
            <p className="mb-3 text-[13px] text-[#d17847]">
              {t("未能拉取网上日运，以下为本地底稿（非网络数据）", "Could not fetch live horoscope — local draft only")}
            </p>
          )}
          <p className="max-w-3xl text-[15px] leading-relaxed text-[#5c564c]">{body}</p>
          {horoscope?.source && (
            <p className="mt-3 text-[10px] text-[#b0aaa0]">{horoscope.source} · {horoscope.date}</p>
          )}
          <div className="mt-5 flex flex-wrap gap-2">
            <Button className="bg-[#1f1a14] hover:bg-[#1f1a14]/90" onClick={() => void polish()} disabled={loading || loadingHoro}>
              {loading ? t("生成中…", "Working…") : t("AI 润色", "AI polish")}
            </Button>
            <SaveReadingButton
              type="zodiac"
              payload={{ sign, scores, source: horoscope?.source, horoscopeDate: horoscope?.date }}
              reading={body}
            />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
