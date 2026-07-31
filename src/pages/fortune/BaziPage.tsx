import { useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { FortunePageHeader } from "@/components/fortune/FortunePageHeader";
import { SaveReadingButton } from "@/components/fortune/SaveReadingButton";
import { Button } from "@/components/ui/button";
import { useLang } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { useFortuneProfile, localDateString } from "@/hooks/useFortune";
import { buildFortuneUserPrompt, requestFortuneReading } from "@/lib/fortune/aiReading";
import { baziRuleBlurb, dayPillarFromDate } from "@/lib/fortune/bazi";

export default function BaziPage() {
  const { t, lang } = useLang();
  const { toast } = useToast();
  const { profile, hasBirthDate } = useFortuneProfile();
  const [reading, setReading] = useState("");
  const [loading, setLoading] = useState(false);

  const pillar = hasBirthDate
    ? dayPillarFromDate(profile!.birth_date!, profile?.birth_hour)
    : null;
  const maxWx = pillar ? Math.max(...pillar.wuxing.map((w) => w.count), 1) : 1;

  async function remind() {
    if (!pillar) return;
    const fallback = baziRuleBlurb(pillar, lang);
    setReading(fallback);
    setLoading(true);
    const res = await requestFortuneReading(
      buildFortuneUserPrompt({
        kind: "bazi",
        lang,
        facts: {
          today: localDateString(),
          pillar,
          birth_date: profile?.birth_date,
          birth_hour: profile?.birth_hour,
        },
      }),
    );
    setLoading(false);
    if (res.ok) setReading(res.text);
    else toast({ title: t("AI 暂不可用，已显示底稿", "AI unavailable — draft shown"), description: res.error });
  }

  return (
    <AppLayout title={t("八字日柱", "BaZi Day Pillar")}>
      <div className="space-y-8">
        <FortunePageHeader
          title={t("八字日柱", "BaZi Day Pillar")}
          subtitle={t("轻量日柱与五行，不做恐吓向细盘", "A gentle day-pillar snapshot — not a full chart")}
          backLabel={t("返回运势", "Back to Fortune")}
        />

        {!hasBirthDate ? (
          <div className="card-premium p-8 text-center">
            <p className="text-[14px] text-[#8a847a]">
              {t("请先在设置填写生日", "Please add birthday in Settings")}
            </p>
            <Link
              to="/settings"
              className="mt-4 inline-flex rounded-lg bg-[#fce0c8] px-4 py-2 text-[13px] font-medium text-[#d17847]"
            >
              {t("去设置", "Open Settings")}
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
            <div className="card-premium space-y-5 p-5">
              <div>
                <p className="text-[12px] font-medium uppercase tracking-wide text-[#8a847a]">
                  {t("日柱", "Day pillar")}
                </p>
                <p className="mt-1 font-mono-data text-[40px] font-semibold text-[#1f1a14]">
                  {pillar!.label}
                </p>
              </div>
              <div className="space-y-2.5">
                {pillar!.wuxing.map((w) => (
                  <div key={w.element} className="flex items-center gap-2 text-[12px]">
                    <span className="w-6 text-[#5c564c]">{w.element}</span>
                    <div className="h-2 flex-1 rounded bg-[#f4f3ee]">
                      <div
                        className="h-2 rounded bg-[#1f1a14]"
                        style={{ width: `${(w.count / maxWx) * 100}%` }}
                      />
                    </div>
                    <span className="w-4 font-mono-data text-[#8a847a]">{w.count}</span>
                  </div>
                ))}
              </div>
              <Button className="w-full bg-[#1f1a14] hover:bg-[#1f1a14]/90" onClick={() => void remind()} disabled={loading}>
                {loading ? t("生成中…", "Working…") : t("今日提醒", "Today's note")}
              </Button>
            </div>

            <div className="card-premium min-h-[280px] p-6">
              {!reading ? (
                <div className="flex min-h-[240px] items-center justify-center text-[14px] text-[#8a847a]">
                  {t("点左侧生成今日提醒", "Generate today's note on the left")}
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-[12px] font-medium uppercase tracking-wide text-[#8a847a]">
                    {t("今日提醒", "Today's note")}
                  </p>
                  <p className="max-w-3xl text-[15px] leading-relaxed text-[#5c564c] whitespace-pre-wrap">
                    {reading}
                  </p>
                  <SaveReadingButton
                    type="bazi"
                    payload={{ pillar, birth_date: profile?.birth_date }}
                    reading={reading}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
