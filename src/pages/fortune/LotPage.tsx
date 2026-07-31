import { useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
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
      <div className="mx-auto max-w-lg space-y-4">
        <Link to="/fortune" className="text-[12px] text-[#8a847a]">
          ← {t("返回运势", "Back")}
        </Link>
        <div
          className={`flex h-40 items-center justify-center rounded-xl border border-dashed border-[#e4e1d7] bg-white text-4xl ${
            shaking ? "animate-pulse" : ""
          }`}
        >
          🎋
        </div>
        <Button className="w-full" onClick={() => void draw()} disabled={loading || shaking}>
          {loading ? t("解读中…", "Reading…") : t("摇签", "Draw a lot")}
        </Button>
        {lot && (
          <div className="space-y-3 rounded-xl border border-[#e4e1d7] bg-white p-4">
            <div className="text-[15px] font-semibold text-[#1f1a14]">
              {lang === "zh" ? lot.rankZh : lot.rankEn} · #{lot.id}
            </div>
            <div className="text-[13px] text-[#5c564c]">
              {lang === "zh" ? lot.verseZh : lot.verseEn}
            </div>
            <p className="text-[13px] leading-relaxed text-[#5c564c] whitespace-pre-wrap">{reading}</p>
            <SaveReadingButton type="lot" payload={lot} reading={reading} className="w-full" />
          </div>
        )}
      </div>
    </AppLayout>
  );
}
