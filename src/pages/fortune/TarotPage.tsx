import { useState } from "react";
import { Link } from "react-router-dom";
import { AppLayout } from "@/components/AppLayout";
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
      <div className="mx-auto max-w-lg space-y-4 rounded-xl bg-[#1a1620] p-4 text-[#f5f0e8]">
        <Link to="/fortune" className="text-[12px] text-[#c9a87c]">
          ← {t("返回运势", "Back")}
        </Link>
        <div className="text-[15px] font-semibold">{t("今天想问什么？", "What do you want to ask?")}</div>
        <div className="flex flex-col gap-2">
          {TOPICS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTopic(item.id)}
              className={`rounded-lg px-3 py-2.5 text-left text-[13px] ${
                topic === item.id ? "bg-[#c9a87c] text-[#1a1620]" : "bg-[#2a2433]"
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
            className="border-[#5a4d6a] bg-[#2a2433] text-[#f5f0e8]"
          />
        )}
        <Button
          className="w-full bg-[#c9a87c] text-[#1a1620] hover:bg-[#b8956a]"
          onClick={() => void draw()}
          disabled={loading}
        >
          {loading ? t("解读中…", "Reading…") : t("抽牌", "Draw")}
        </Button>

        {cards.length > 0 && (
          <div className="space-y-3">
            <div className="flex justify-center gap-2">
              {cards.map((c) => (
                <div
                  key={c.position}
                  className="flex h-24 w-16 flex-col items-center justify-center rounded-lg border border-[#c9a87c] bg-gradient-to-b from-[#3d3550] to-[#1a1620] px-1 text-center text-[10px]"
                >
                  <div>{lang === "zh" ? c.card.nameZh : c.card.nameEn}</div>
                  <div className="opacity-70">
                    {c.upright
                      ? lang === "zh"
                        ? "正位"
                        : "Up"
                      : lang === "zh"
                        ? "逆位"
                        : "Rev"}
                  </div>
                </div>
              ))}
            </div>
            <div className="text-[11px] opacity-60">
              {lang === "zh" ? "过去 · 现在 · 建议" : "Past · Present · Advice"}
            </div>
            <div className="rounded-xl bg-[#2a2433] p-3 text-[12px] leading-relaxed whitespace-pre-wrap">
              {reading}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 border-[#5a4d6a] bg-transparent text-[#f5f0e8]"
                onClick={() => void draw()}
              >
                {t("再抽一次", "Draw again")}
              </Button>
              <SaveReadingButton
                className="flex-1 bg-[#c9a87c] text-[#1a1620] hover:bg-[#b8956a]"
                type="tarot"
                question={question}
                payload={{ seed, cards }}
                reading={reading}
              />
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
