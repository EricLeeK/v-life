import { useEffect, useRef, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { AlmanacCard } from "@/components/fortune/AlmanacCard";
import { DailyHero } from "@/components/fortune/DailyHero";
import { MoonCard } from "@/components/fortune/MoonCard";
import { MetricStarCard } from "@/components/fortune/StarRow";
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
import { ZODIAC_LABELS } from "@/lib/fortune/zodiac";
import { SHENGXIAO_LABELS } from "@/lib/fortune/shengxiao";

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

  const tags = [
    lang === "zh" ? "黄历" : "Almanac",
    lang === "zh" ? "月相" : "Moon",
    lang === "zh" ? "塔罗" : "Tarot",
    lang === "zh" ? "星座" : "Zodiac",
    lang === "zh" ? "易经" : "I Ching",
    lang === "zh" ? "求签" : "Lot",
  ];

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
      <div className="space-y-10">
        {/* Hero — same rhythm as dashboard */}
        <section>
          <h1
            className="font-bold leading-[1.1] tracking-tight text-[#1f1a14] heading-font"
            style={{ fontSize: "clamp(34px, 4.8vw, 64px)" }}
          >
            {t("今日运势", "Today's Fortune")}
          </h1>
          <p className="mt-2 text-[14px] text-[#8a847a]">{lunarLabelForDate(date, lang)}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-[#e4e1d7] bg-white px-2.5 py-0.5 text-[11px] font-medium text-[#8a847a]"
              >
                {tag}
              </span>
            ))}
            {hasBirthDate && profile?.zodiac_sign && (
              <span className="rounded-full bg-[#e1eaf4] px-2.5 py-0.5 text-[11px] font-medium text-[#5b88b5]">
                {lang === "zh"
                  ? ZODIAC_LABELS[profile.zodiac_sign].zh
                  : ZODIAC_LABELS[profile.zodiac_sign].en}
              </span>
            )}
            {hasBirthDate && profile?.shengxiao && (
              <span className="rounded-full bg-[#f5e8b8] px-2.5 py-0.5 text-[11px] font-medium text-[#c49840]">
                {lang === "zh"
                  ? `属${SHENGXIAO_LABELS[profile.shengxiao].zh}`
                  : SHENGXIAO_LABELS[profile.shengxiao].en}
              </span>
            )}
          </div>
        </section>

        {/* Metric strip */}
        <section>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricStarCard
              label={t("整体", "Overall")}
              value={scores.overall}
              hint={cachePayload?.meta || rule.meta}
            />
            <MetricStarCard label={t("爱情", "Love")} value={scores.love} />
            <MetricStarCard label={t("事业", "Career")} value={scores.career} />
            <MetricStarCard label={t("财运", "Wealth")} value={scores.wealth} />
          </div>
        </section>

        {/* Reading + calendar cards */}
        <section className="space-y-4">
          <div className="flex items-baseline justify-between">
            <div>
              <h2
                className="font-bold leading-tight text-[#1f1a14] heading-font"
                style={{ fontSize: "clamp(24px, 3vw, 32px)" }}
              >
                {t("今日解读", "Today's Reading")}
              </h2>
              <p className="mt-1 text-[12px] text-[#8a847a]">
                {t("规则底稿 + AI 润色", "Rule base + AI polish")}
              </p>
            </div>
          </div>
          <DailyHero
            meta={cachePayload?.meta || rule.meta}
            headline={cachePayload?.headline || rule.headline}
            body={body}
            scores={scores}
            lang={lang}
            needsProfile={!hasBirthDate}
          />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <AlmanacCard data={almanac} lang={lang} />
            <MoonCard data={moon} lang={lang} />
          </div>
        </section>

        <ToolGrid lang={lang} />
      </div>
    </AppLayout>
  );
}
