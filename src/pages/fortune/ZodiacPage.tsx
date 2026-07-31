import { useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
import { SaveReadingButton } from "@/components/fortune/SaveReadingButton";
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
      <div className="mx-auto max-w-lg space-y-4">
        <Link to="/fortune" className="text-[12px] text-[#8a847a]">
          ← {t("返回运势", "Back")}
        </Link>
        <Select value={sign} onValueChange={(v) => setSign(v as ZodiacSign)}>
          <SelectTrigger>
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
        <div className="rounded-xl border border-[#e4e1d7] bg-white p-4 text-[13px] text-[#5c564c]">
          {reading || rule.body}
        </div>
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => void polish()} disabled={loading}>
            {loading ? t("生成中…", "Working…") : t("AI 润色", "AI polish")}
          </Button>
          <SaveReadingButton
            className="flex-1"
            type="zodiac"
            payload={{ sign, scores }}
            reading={reading || rule.body}
          />
        </div>
      </div>
    </AppLayout>
  );
}
