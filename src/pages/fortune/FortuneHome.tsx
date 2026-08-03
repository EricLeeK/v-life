import { useEffect, useMemo, useRef, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { AlmanacCard } from "@/components/fortune/AlmanacCard";
import { DailyHero } from "@/components/fortune/DailyHero";
import { MoonCard } from "@/components/fortune/MoonCard";
import { MetricPercentCard } from "@/components/fortune/StarRow";
import { ToolGrid } from "@/components/fortune/ToolGrid";
import { useLang } from "@/contexts/LanguageContext";
import { useDemoMode } from "@/contexts/DemoModeContext";
import {
  localDateString,
  useFortuneDailyCache,
  useFortuneProfile,
  useUpsertFortuneDailyCache,
} from "@/hooks/useFortune";
import { getAlmanacForDate } from "@/lib/fortune/almanac";
import { buildDailyFortuneFacts } from "@/lib/fortune/dailyFacts";
import { buildFortuneUserPrompt, requestFortuneReading } from "@/lib/fortune/aiReading";
import {
  pickCachedDailyAi,
  writeLocalDailyAi,
  type DailyAiByLang,
} from "@/lib/fortune/dailyAiCache";
import { fetchHoroscope, zodiacFactorFromStars, type HoroscopeDay } from "@/lib/fortune/horoscope";
import { lunarLabelForDate, weekdayLabel } from "@/lib/fortune/lunarLabel";
import { getMoonPhase } from "@/lib/fortune/moon";
import { scoresToPercents } from "@/lib/fortune/percentScore";
import { buildDailyRuleCopy } from "@/lib/fortune/ruleCopy";
import { FORTUNE_RULE_VERSION } from "@/lib/fortune/ruleVersion";
import { dailyScores } from "@/lib/fortune/scores";
import { ZODIAC_LABELS } from "@/lib/fortune/zodiac";
import { SHENGXIAO_LABELS } from "@/lib/fortune/shengxiao";

export default function FortuneHome() {
  const { t, lang } = useLang();
  const { isDemo } = useDemoMode();
  const date = localDateString();
  const { profile, hasBirthDate } = useFortuneProfile();
  const { data: cache, isFetched: cacheFetched, isLoading: cacheLoading } = useFortuneDailyCache(date);
  const upsert = useUpsertFortuneDailyCache();
  const generating = useRef(false);
  const [aiBody, setAiBody] = useState<string | null>(null);
  const [horoscope, setHoroscope] = useState<HoroscopeDay | null>(null);
  const [horoscopeReady, setHoroscopeReady] = useState(!profile?.zodiac_sign);

  const cachePayload = (cache?.payload || null) as {
    headline?: string;
    body?: string;
    meta?: string;
    aiBody?: string;
    aiLang?: string;
    aiByLang?: DailyAiByLang;
    horoscope?: HoroscopeDay;
    ruleVersion?: string;
    lunar?: { weekday?: string };
  } | null;

  // Reset in-memory AI when calendar day or UI language changes
  useEffect(() => {
    setAiBody(null);
    generating.current = false;
  }, [date, lang]);

  useEffect(() => {
    if (cachePayload?.horoscope?.text && cachePayload.horoscope.sign === profile?.zodiac_sign) {
      setHoroscope(cachePayload.horoscope);
      setHoroscopeReady(true);
      return;
    }
    if (!profile?.zodiac_sign) {
      setHoroscope(null);
      setHoroscopeReady(true);
      return;
    }
    setHoroscopeReady(false);
    let cancelled = false;
    void fetchHoroscope(profile.zodiac_sign, lang).then((res) => {
      if (cancelled) return;
      if (res.ok) setHoroscope(res.data);
      else setHoroscope(null);
      setHoroscopeReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, [profile?.zodiac_sign, cachePayload?.horoscope, lang]);

  const scores = useMemo(
    () =>
      dailyScores({
        date,
        zodiac: profile?.zodiac_sign,
        shengxiao: profile?.shengxiao,
        zodiacFactor: horoscope ? zodiacFactorFromStars(horoscope.stars.overall) : null,
      }),
    [date, profile?.zodiac_sign, profile?.shengxiao, horoscope],
  );
  const percents = useMemo(
    () =>
      scoresToPercents(
        scores,
        `${date}|${profile?.zodiac_sign || "g"}|${profile?.shengxiao || "g"}`,
      ),
    [scores, date, profile?.zodiac_sign, profile?.shengxiao],
  );

  const rule = buildDailyRuleCopy({
    date,
    scores,
    profile: hasBirthDate ? profile : null,
    lang,
    overallPercent: percents.overall,
  });
  const almanac = getAlmanacForDate(date);
  const moon = getMoonPhase(date);

  const cachedAi = pickCachedDailyAi(cachePayload, lang, date);
  const body = aiBody || cachedAi || rule.body;

  const tags = [
    lang === "zh" ? "黄历" : "Almanac",
    lang === "zh" ? "月相" : "Moon",
    lang === "zh" ? "塔罗" : "Tarot",
    lang === "zh" ? "星座" : "Zodiac",
    lang === "zh" ? "易经" : "I Ching",
    lang === "zh" ? "求签" : "Lot",
  ];

  // Generate at most once per date+lang; prefer DB / localStorage cache.
  useEffect(() => {
    if (aiBody || cachedAi) {
      if (cachedAi && !aiBody) setAiBody(cachedAi);
      return;
    }
    // Logged-in: wait until today's row is loaded (or known empty)
    if (!isDemo && cacheLoading) return;
    if (!isDemo && !cacheFetched) return;
    if (!horoscopeReady) return;
    if (generating.current) return;
    generating.current = true;

    const facts = buildDailyFortuneFacts({
      date,
      lang,
      scores,
      profile: hasBirthDate ? profile : null,
      almanac,
      moon,
      horoscope,
      ruleBody: rule.body,
    });
    const prompt = buildFortuneUserPrompt({
      kind: "daily",
      lang,
      facts,
    });

    void requestFortuneReading(prompt).then((res) => {
      if (!res.ok) {
        generating.current = false;
        return;
      }
      setAiBody(res.text);
      writeLocalDailyAi(date, lang, res.text);

      const prevByLang: DailyAiByLang = { ...(cachePayload?.aiByLang || {}) };
      prevByLang[lang] = res.text;

      void upsert.mutateAsync({
        cache_date: date,
        payload: {
          headline: rule.headline,
          body: rule.body,
          meta: rule.meta,
          aiBody: res.text,
          aiLang: lang,
          aiByLang: prevByLang,
          scores,
          percents,
          horoscope: horoscope || undefined,
          lunar: {
            dayPillar: almanac.dayPillar,
            chongsha: almanac.chongsha,
            zhiXing: almanac.zhiXing,
            weekday: weekdayLabel(date, lang),
          },
          ruleVersion: FORTUNE_RULE_VERSION,
        },
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, lang, horoscopeReady, cacheLoading, cacheFetched, cachedAi, aiBody]);

  return (
    <AppLayout title={t("运势", "Fortune")}>
      <div className="space-y-10">
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

        <section>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <MetricPercentCard
              label={t("整体", "Overall")}
              value={percents.overall}
              hint={cachePayload?.meta || rule.meta}
            />
            <MetricPercentCard label={t("爱情", "Love")} value={percents.love} />
            <MetricPercentCard label={t("事业", "Career")} value={percents.career} />
            <MetricPercentCard label={t("财运", "Wealth")} value={percents.wealth} />
          </div>
        </section>

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
                {t("当日生成一次，刷新沿用", "Generated once per day")}
              </p>
            </div>
          </div>
          <DailyHero
            meta={cachePayload?.meta || rule.meta}
            headline={cachePayload?.headline || rule.headline}
            body={body}
            overallPercent={percents.overall}
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
