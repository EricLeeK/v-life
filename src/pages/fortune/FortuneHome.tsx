import { useEffect, useRef, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { AlmanacCard } from "@/components/fortune/AlmanacCard";
import { DailyHero } from "@/components/fortune/DailyHero";
import { MoonCard } from "@/components/fortune/MoonCard";
import { ToolGrid } from "@/components/fortune/ToolGrid";
import { useLang } from "@/contexts/LanguageContext";
import {
  localDateString,
  useFortuneDailyCache,
  useFortuneProfile,
  useUpsertFortuneDailyCache,
} from "@/hooks/useFortune";
import { getAlmanacForDate } from "@/lib/fortune/almanac";
import { buildFortuneUserPrompt, requestFortuneReading } from "@/lib/fortune/aiReading";
import { lunarLabelForDate } from "@/lib/fortune/lunarLabel";
import { getMoonPhase } from "@/lib/fortune/moon";
import { buildDailyRuleCopy } from "@/lib/fortune/ruleCopy";
import { dailyScores } from "@/lib/fortune/scores";

export default function FortuneHome() {
  const { t, lang } = useLang();
  const date = localDateString();
  const { profile, hasBirthDate } = useFortuneProfile();
  const { data: cache } = useFortuneDailyCache(date);
  const upsert = useUpsertFortuneDailyCache();
  const requested = useRef(false);
  const [aiBody, setAiBody] = useState<string | null>(null);

  const scores = dailyScores({
    date,
    zodiac: profile?.zodiac_sign,
    shengxiao: profile?.shengxiao,
  });
  const rule = buildDailyRuleCopy({
    date,
    scores,
    profile: hasBirthDate ? profile : null,
    lang,
  });
  const almanac = getAlmanacForDate(date);
  const moon = getMoonPhase(date);

  const cachePayload = (cache?.payload || null) as {
    headline?: string;
    body?: string;
    meta?: string;
    aiBody?: string;
  } | null;

  const body = aiBody || cachePayload?.aiBody || cachePayload?.body || rule.body;

  useEffect(() => {
    if (requested.current) return;
    if (cachePayload?.aiBody) {
      setAiBody(cachePayload.aiBody);
      return;
    }
    requested.current = true;
    const prompt = buildFortuneUserPrompt({
      kind: "daily",
      lang,
      facts: {
        date,
        scores,
        zodiac: profile?.zodiac_sign,
        shengxiao: profile?.shengxiao,
        almanac,
        moon: moon.phaseZh,
        ruleBody: rule.body,
      },
    });
    void requestFortuneReading(prompt).then((res) => {
      if (!res.ok) return;
      setAiBody(res.text);
      void upsert.mutateAsync({
        cache_date: date,
        payload: {
          headline: rule.headline,
          body: rule.body,
          meta: rule.meta,
          aiBody: res.text,
          scores,
        },
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, lang]);

  return (
    <AppLayout title={t("运势", "Fortune")}>
      <div className="mx-auto max-w-lg space-y-4 pb-8">
        <div className="text-center">
          <div className="text-[12px] tracking-wide text-[#8a847a]">
            {lunarLabelForDate(date, lang)}
          </div>
          <h1 className="mt-1 text-lg font-semibold text-[#1f1a14]">
            {t("今日运势", "Today's Fortune")}
          </h1>
        </div>

        <DailyHero
          meta={cachePayload?.meta || rule.meta}
          headline={cachePayload?.headline || rule.headline}
          body={body}
          scores={scores}
          lang={lang}
          needsProfile={!hasBirthDate}
        />

        <div className="grid grid-cols-2 gap-2">
          <AlmanacCard data={almanac} lang={lang} />
          <MoonCard data={moon} lang={lang} />
        </div>

        <ToolGrid lang={lang} />
      </div>
    </AppLayout>
  );
}
