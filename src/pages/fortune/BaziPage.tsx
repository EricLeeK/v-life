import { useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
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
      <div className="mx-auto max-w-lg space-y-4">
        <Link to="/fortune" className="text-[12px] text-[#8a847a]">
          ← {t("返回运势", "Back")}
        </Link>
        {!hasBirthDate ? (
          <Link
            to="/settings"
            className="block rounded-xl border border-[#e4e1d7] bg-white p-4 text-center text-[13px] text-[#d17847]"
          >
            {t("请先在设置填写生日", "Please add birthday in Settings")}
          </Link>
        ) : (
          <>
            <div className="rounded-xl border border-[#e4e1d7] bg-white p-4">
              <div className="text-[11px] text-[#8a847a]">{t("日柱", "Day pillar")}</div>
              <div className="mt-1 text-2xl font-semibold text-[#1f1a14]">{pillar!.label}</div>
              <div className="mt-4 space-y-2">
                {pillar!.wuxing.map((w) => (
                  <div key={w.element} className="flex items-center gap-2 text-[12px]">
                    <span className="w-6 text-[#5c564c]">{w.element}</span>
                    <div className="h-2 flex-1 rounded bg-[#f4f3ee]">
                      <div
                        className="h-2 rounded bg-[#1f1a14]"
                        style={{ width: `${(w.count / maxWx) * 100}%` }}
                      />
                    </div>
                    <span className="w-4 text-[#8a847a]">{w.count}</span>
                  </div>
                ))}
              </div>
            </div>
            <Button className="w-full" onClick={() => void remind()} disabled={loading}>
              {loading ? t("生成中…", "Working…") : t("今日提醒", "Today's note")}
            </Button>
            {reading && (
              <div className="space-y-3 rounded-xl border border-[#e4e1d7] bg-white p-4">
                <p className="text-[13px] leading-relaxed text-[#5c564c] whitespace-pre-wrap">{reading}</p>
                <SaveReadingButton
                  type="bazi"
                  payload={{ pillar, birth_date: profile?.birth_date }}
                  reading={reading}
                  className="w-full"
                />
              </div>
            )}
          </>
        )}
      </div>
    </AppLayout>
  );
}
