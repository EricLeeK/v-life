import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { FortunePageHeader } from "@/components/fortune/FortunePageHeader";
import { SaveReadingButton } from "@/components/fortune/SaveReadingButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLang } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { buildFortuneUserPrompt, requestFortuneReading } from "@/lib/fortune/aiReading";
import { castHexagram, ichingRuleBlurb, type IchingCast } from "@/lib/fortune/iching";

export default function IchingPage() {
  const { t, lang } = useLang();
  const { toast } = useToast();
  const [question, setQuestion] = useState("");
  const [cast, setCast] = useState<IchingCast | null>(null);
  const [reading, setReading] = useState("");
  const [loading, setLoading] = useState(false);

  async function castNow() {
    const seed = crypto.randomUUID();
    const result = castHexagram(seed);
    setCast(result);
    const fallback = ichingRuleBlurb(result, lang);
    setReading(fallback);
    setLoading(true);
    const res = await requestFortuneReading(
      buildFortuneUserPrompt({
        kind: "iching",
        lang,
        question: question || (lang === "zh" ? "今日指引" : "Daily guidance"),
        facts: {
          hexagram: result.hexagramNumber,
          nameZh: result.nameZh,
          nameEn: result.nameEn,
          changingLines: result.changingLines,
          lines: result.lines,
        },
      }),
    );
    setLoading(false);
    if (res.ok) setReading(res.text);
    else toast({ title: t("AI 暂不可用，已显示底稿", "AI unavailable — draft shown"), description: res.error });
  }

  return (
    <AppLayout title={t("易经起卦", "I Ching")}>
      <div className="space-y-8">
        <FortunePageHeader
          title={t("易经起卦", "I Ching")}
          subtitle={t("心念问题，一键模拟铜钱起卦", "Hold a question, then cast with virtual coins")}
          backLabel={t("返回运势", "Back to Fortune")}
        />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
          <div className="card-premium space-y-4 p-5">
            <Input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder={t("心中默念一个问题（可选）", "Hold a question (optional)")}
            />
            <Button className="w-full bg-[#1f1a14] hover:bg-[#1f1a14]/90" onClick={() => void castNow()} disabled={loading}>
              {loading ? t("解读中…", "Reading…") : t("一键起卦", "Cast")}
            </Button>
          </div>

          <div className="card-premium min-h-[320px] p-5">
            {!cast ? (
              <div className="flex min-h-[280px] items-center justify-center text-[14px] text-[#8a847a]">
                {t("起卦结果会显示在这里", "Your hexagram will appear here")}
              </div>
            ) : (
              <div className="grid gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
                <div>
                  <p className="font-mono-data text-[28px] font-semibold text-[#1f1a14]">
                    {lang === "zh" ? cast.nameZh : cast.nameEn}
                  </p>
                  <p className="mt-1 text-[12px] text-[#8a847a]">
                    {lang === "zh" ? `第 ${cast.hexagramNumber} 卦` : `Hexagram #${cast.hexagramNumber}`}
                  </p>
                  <div className="mt-4 flex flex-col-reverse gap-1.5">
                    {cast.lines.map((line, i) => (
                      <div key={i} className="flex items-center gap-2 text-[12px] text-[#5c564c]">
                        <span className="w-4 font-mono-data">{i + 1}</span>
                        <div className={`h-2.5 flex-1 rounded ${line.yang ? "bg-[#1f1a14]" : "bg-[#1f1a14]/25"}`} />
                        {line.changing && (
                          <span className="text-[#d17847]">{lang === "zh" ? "变" : "chg"}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-[12px] font-medium uppercase tracking-wide text-[#8a847a]">
                    {t("解读", "Reading")}
                  </p>
                  <p className="text-[15px] leading-relaxed text-[#5c564c] whitespace-pre-wrap">{reading}</p>
                  <div className="mt-5">
                    <SaveReadingButton type="iching" question={question} payload={cast} reading={reading} />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
