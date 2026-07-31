import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { FortunePageHeader } from "@/components/fortune/FortunePageHeader";
import { SaveReadingButton } from "@/components/fortune/SaveReadingButton";
import { Button } from "@/components/ui/button";
import { useLang } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { buildFortuneUserPrompt, requestFortuneReading } from "@/lib/fortune/aiReading";
import { drawLot, type LotResult } from "@/lib/fortune/lot";

export default function LotPage() {
  const { t, lang } = useLang();
  const { toast } = useToast();
  const [lot, setLot] = useState<LotResult | null>(null);
  const [reading, setReading] = useState("");
  const [shaking, setShaking] = useState(false);
  const [loading, setLoading] = useState(false);

  async function draw() {
    setShaking(true);
    await new Promise((r) => setTimeout(r, 600));
    setShaking(false);
    const seed = crypto.randomUUID();
    const result = drawLot(seed);
    setLot(result);
    const fallback = lang === "zh" ? `${result.rankZh}：${result.verseZh}` : `${result.rankEn}: ${result.verseEn}`;
    setReading(fallback);
    setLoading(true);
    const res = await requestFortuneReading(
      buildFortuneUserPrompt({
        kind: "lot",
        lang,
        facts: result,
      }),
    );
    setLoading(false);
    if (res.ok) setReading(res.text);
    else toast({ title: t("AI 暂不可用，已显示底稿", "AI unavailable — draft shown"), description: res.error });
  }

  return (
    <AppLayout title={t("求签", "Lot")}>
      <div className="space-y-8">
        <FortunePageHeader
          title={t("求签", "Lot")}
          subtitle={t("摇一支签，看今日温柔提醒", "Draw a lot for a gentle daily cue")}
          backLabel={t("返回运势", "Back to Fortune")}
        />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
          <div className="card-premium flex flex-col items-center justify-center gap-4 p-8">
            <div
              className={`flex h-36 w-full items-center justify-center rounded-lg bg-[#f4f3ee] text-5xl ${
                shaking ? "animate-pulse" : ""
              }`}
            >
              🎋
            </div>
            <Button className="w-full bg-[#1f1a14] hover:bg-[#1f1a14]/90" onClick={() => void draw()} disabled={loading || shaking}>
              {loading ? t("解读中…", "Reading…") : t("摇签", "Draw a lot")}
            </Button>
          </div>

          <div className="card-premium min-h-[320px] p-6">
            {!lot ? (
              <div className="flex min-h-[280px] items-center justify-center text-[14px] text-[#8a847a]">
                {t("签文会显示在这里", "Your lot verse will appear here")}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-baseline gap-3">
                  <p className="font-mono-data text-[28px] font-semibold text-[#1f1a14]">
                    {lang === "zh" ? lot.rankZh : lot.rankEn}
                  </p>
                  <span className="text-[12px] text-[#8a847a]">#{lot.id}</span>
                </div>
                <p className="text-[16px] text-[#1f1a14]">
                  {lang === "zh" ? lot.verseZh : lot.verseEn}
                </p>
                <p className="max-w-3xl text-[15px] leading-relaxed text-[#5c564c] whitespace-pre-wrap">
                  {reading}
                </p>
                <SaveReadingButton type="lot" payload={lot} reading={reading} />
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
