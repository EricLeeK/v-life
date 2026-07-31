import { useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
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
      <div className="mx-auto max-w-lg space-y-4">
        <Link to="/fortune" className="text-[12px] text-[#8a847a]">
          ← {t("返回运势", "Back")}
        </Link>
        <Input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={t("心中默念一个问题（可选）", "Hold a question (optional)")}
        />
        <Button className="w-full" onClick={() => void castNow()} disabled={loading}>
          {loading ? t("解读中…", "Reading…") : t("一键起卦", "Cast")}
        </Button>
        {cast && (
          <div className="space-y-3 rounded-xl border border-[#e4e1d7] bg-white p-4">
            <div className="text-[15px] font-semibold text-[#1f1a14]">
              {lang === "zh"
                ? `${cast.nameZh} · 第 ${cast.hexagramNumber} 卦`
                : `${cast.nameEn} · #${cast.hexagramNumber}`}
            </div>
            <div className="flex flex-col-reverse gap-1">
              {cast.lines.map((line, i) => (
                <div key={i} className="flex items-center gap-2 text-[12px] text-[#5c564c]">
                  <span className="w-4">{i + 1}</span>
                  <div
                    className={`h-2 flex-1 rounded ${
                      line.yang ? "bg-[#1f1a14]" : "bg-[#1f1a14]/30"
                    }`}
                  />
                  {line.changing && (
                    <span className="text-[#d17847]">{lang === "zh" ? "变" : "chg"}</span>
                  )}
                </div>
              ))}
            </div>
            <p className="text-[13px] leading-relaxed text-[#5c564c] whitespace-pre-wrap">{reading}</p>
            <SaveReadingButton
              type="iching"
              question={question}
              payload={cast}
              reading={reading}
              className="w-full"
            />
          </div>
        )}
      </div>
    </AppLayout>
  );
}
