import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { FortunePageHeader } from "@/components/fortune/FortunePageHeader";
import { SaveReadingButton } from "@/components/fortune/SaveReadingButton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLang } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { buildFortuneUserPrompt, requestFortuneReading } from "@/lib/fortune/aiReading";
import { drawTarotSpread, tarotRuleBlurb, type DrawnCard } from "@/lib/fortune/tarot";

const TOPICS = [
  { id: "love", zh: "感情", en: "Love" },
  { id: "career", zh: "事业 / 学业", en: "Career / Study" },
  { id: "daily", zh: "今日指引", en: "Daily guidance" },
  { id: "custom", zh: "自己写一句", en: "Custom" },
];

const POS_LABEL = {
  past: { zh: "过去", en: "Past" },
  present: { zh: "现在", en: "Present" },
  advice: { zh: "建议", en: "Advice" },
};

export default function TarotPage() {
  const { t, lang } = useLang();
  const { toast } = useToast();
  const [topic, setTopic] = useState("daily");
  const [custom, setCustom] = useState("");
  const [seed, setSeed] = useState<string | null>(null);
  const [cards, setCards] = useState<DrawnCard[]>([]);
  const [reading, setReading] = useState("");
  const [loading, setLoading] = useState(false);

  const question =
    topic === "custom"
      ? custom.trim() || (lang === "zh" ? "今日指引" : "Daily guidance")
      : TOPICS.find((x) => x.id === topic)?.[lang === "zh" ? "zh" : "en"] || "daily";

  async function draw() {
    const s = crypto.randomUUID();
    const spread = drawTarotSpread(s);
    setSeed(s);
    setCards(spread.cards);
    const fallback = tarotRuleBlurb(spread.cards, lang);
    setReading(fallback);
    setLoading(true);
    const prompt = buildFortuneUserPrompt({
      kind: "tarot",
      lang,
      question,
      facts: {
        positions: spread.cards.map((c) => ({
          position: c.position,
          name: lang === "zh" ? c.card.nameZh : c.card.nameEn,
          upright: c.upright,
        })),
      },
    });
    const res = await requestFortuneReading(prompt);
    setLoading(false);
    if (res.ok) setReading(res.text);
    else {
      toast({
        title: t("AI 暂不可用，已显示底稿", "AI unavailable — showing draft"),
        description: res.error,
      });
    }
  }

  return (
    <AppLayout title={t("塔罗抽牌", "Tarot")}>
      <div className="space-y-8">
        <FortunePageHeader
          title={t("塔罗抽牌", "Tarot")}
          subtitle={t("选题后抽三张：过去 · 现在 · 建议", "Pick a topic, then draw three cards")}
          backLabel={t("返回运势", "Back to Fortune")}
        />

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
          {/* Controls */}
          <div className="card-premium space-y-4 p-5">
            <p className="text-[12px] font-medium uppercase tracking-wide text-[#8a847a]">
              {t("今天想问什么？", "What do you want to ask?")}
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
              {TOPICS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTopic(item.id)}
                  className={`rounded-lg border px-3 py-2.5 text-left text-[13px] transition-colors ${
                    topic === item.id
                      ? "border-[#1f1a14] bg-[#1f1a14] text-white"
                      : "border-[#e4e1d7] bg-white text-[#1f1a14] hover:bg-[#f4f3ee]"
                  }`}
                >
                  {lang === "zh" ? item.zh : item.en}
                </button>
              ))}
            </div>
            {topic === "custom" && (
              <Input
                value={custom}
                onChange={(e) => setCustom(e.target.value)}
                placeholder={t("写一句你的问题", "Write your question")}
              />
            )}
            <Button className="w-full bg-[#1f1a14] hover:bg-[#1f1a14]/90" onClick={() => void draw()} disabled={loading}>
              {loading ? t("解读中…", "Reading…") : t("抽牌", "Draw")}
            </Button>
          </div>

          {/* Result */}
          <div className="card-premium min-h-[320px] p-5">
            {cards.length === 0 ? (
              <div className="flex h-full min-h-[280px] flex-col items-center justify-center text-center">
                <p className="text-[14px] text-[#8a847a]">
                  {t("选好问题后点抽牌，牌面会铺在这里", "Choose a question and draw — cards appear here")}
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {cards.map((c) => (
                    <div
                      key={c.position}
                      className="rounded-lg border border-[#e4e1d7] bg-[#f4f3ee] px-4 py-5 text-center"
                    >
                      <p className="text-[11px] uppercase tracking-wide text-[#8a847a]">
                        {lang === "zh" ? POS_LABEL[c.position].zh : POS_LABEL[c.position].en}
                      </p>
                      <p className="mt-2 text-[16px] font-semibold text-[#1f1a14]">
                        {lang === "zh" ? c.card.nameZh : c.card.nameEn}
                      </p>
                      <p className="mt-1 text-[12px] text-[#c49840]">
                        {c.upright
                          ? lang === "zh"
                            ? "正位"
                            : "Upright"
                          : lang === "zh"
                            ? "逆位"
                            : "Reversed"}
                      </p>
                    </div>
                  ))}
                </div>
                <div>
                  <p className="mb-2 text-[12px] font-medium uppercase tracking-wide text-[#8a847a]">
                    {t("解读", "Reading")}
                  </p>
                  <p className="max-w-3xl text-[15px] leading-relaxed text-[#5c564c] whitespace-pre-wrap">
                    {reading}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => void draw()}>
                    {t("再抽一次", "Draw again")}
                  </Button>
                  <SaveReadingButton
                    type="tarot"
                    question={question}
                    payload={{ seed, cards }}
                    reading={reading}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
