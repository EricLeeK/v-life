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
      <div className="mx-auto max-w-lg space-y-4">
        <Link to="/fortune" className="text-[12px] text-[#8a847a]">
          ← {t("返回运势", "Back")}
        </Link>
        <Select value={animal} onValueChange={(v) => setAnimal(v as Shengxiao)}>
          <SelectTrigger>
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
        <div className="rounded-xl border border-[#e4e1d7] bg-white p-4 text-[13px] text-[#5c564c]">
          {reading || rule.body}
        </div>
        <div className="flex gap-2">
          <Button className="flex-1" onClick={() => void polish()} disabled={loading}>
            {loading ? t("生成中…", "Working…") : t("AI 润色", "AI polish")}
          </Button>
          <SaveReadingButton
            className="flex-1"
            type="shengxiao"
            payload={{ animal, scores }}
            reading={reading || rule.body}
          />
        </div>
      </div>
    </AppLayout>
  );
}
