import { useNavigate } from "react-router-dom";
import {
  Sparkles,
  Stars,
  Hexagon,
  ScrollText,
  Cat,
  CircleDot,
  History,
  ChevronRight,
} from "lucide-react";

const TOOLS = [
  {
    to: "/fortune/tarot",
    zh: "塔罗抽牌",
    en: "Tarot",
    descZh: "三牌阵 · 过去现在建议",
    descEn: "3-card spread",
    icon: Sparkles,
    color: "text-[#8b7bb8]",
    bg: "bg-[#e7ddf1]",
    group: "west" as const,
  },
  {
    to: "/fortune/zodiac",
    zh: "星座详解",
    en: "Zodiac",
    descZh: "今日星座节奏",
    descEn: "Daily sign reading",
    icon: Stars,
    color: "text-[#5b88b5]",
    bg: "bg-[#e1eaf4]",
    group: "west" as const,
  },
  {
    to: "/fortune/iching",
    zh: "易经起卦",
    en: "I Ching",
    descZh: "铜钱起卦白话解",
    descEn: "Coin cast + plain talk",
    icon: Hexagon,
    color: "text-[#5b8c44]",
    bg: "bg-[#dcead4]",
    group: "east" as const,
  },
  {
    to: "/fortune/lot",
    zh: "求签",
    en: "Lot",
    descZh: "摇一支今日签",
    descEn: "Draw today's lot",
    icon: ScrollText,
    color: "text-[#d17847]",
    bg: "bg-[#fce0c8]",
    group: "east" as const,
  },
  {
    to: "/fortune/shengxiao",
    zh: "生肖运势",
    en: "Shengxiao",
    descZh: "属相今日提醒",
    descEn: "Zodiac animal vibe",
    icon: Cat,
    color: "text-[#c49840]",
    bg: "bg-[#f5e8b8]",
    group: "east" as const,
  },
  {
    to: "/fortune/bazi",
    zh: "八字日柱",
    en: "BaZi",
    descZh: "日柱与五行简图",
    descEn: "Day pillar snapshot",
    icon: CircleDot,
    color: "text-[#5a9da8]",
    bg: "bg-[#cfe4df]",
    group: "east" as const,
  },
];

export function ToolGrid({ lang }: { lang: "zh" | "en" }) {
  const navigate = useNavigate();
  const west = TOOLS.filter((t) => t.group === "west");
  const east = TOOLS.filter((t) => t.group === "east");

  const renderCard = (item: (typeof TOOLS)[number]) => {
    const Icon = item.icon;
    return (
      <button
        key={item.to}
        type="button"
        onClick={() => navigate(item.to)}
        className="card-premium group flex w-full items-start gap-3 p-4 text-left"
      >
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${item.bg}`}>
          <Icon className={`h-4 w-4 ${item.color}`} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold text-foreground">
            {lang === "zh" ? item.zh : item.en}
          </p>
          <p className="mt-0.5 text-[12px] text-muted-foreground">
            {lang === "zh" ? item.descZh : item.descEn}
          </p>
        </div>
        <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-[#e4e1d7] transition-colors group-hover:text-muted-foreground" />
      </button>
    );
  };

  return (
    <div className="space-y-8">
      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <div>
            <h2
              className="font-bold leading-tight text-foreground heading-font"
              style={{ fontSize: "clamp(22px, 2.6vw, 28px)" }}
            >
              {lang === "zh" ? "西式占卜" : "Western"}
            </h2>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {lang === "zh" ? "塔罗与星座" : "Tarot & zodiac"}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">{west.map(renderCard)}</div>
      </section>

      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <div>
            <h2
              className="font-bold leading-tight text-foreground heading-font"
              style={{ fontSize: "clamp(22px, 2.6vw, 28px)" }}
            >
              {lang === "zh" ? "中式运势" : "Chinese"}
            </h2>
            <p className="mt-1 text-[12px] text-muted-foreground">
              {lang === "zh" ? "易经、求签、生肖与日柱" : "I Ching, lots, shengxiao & day pillar"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/fortune/history")}
            className="inline-flex items-center gap-1 text-[12px] text-muted-foreground transition-colors hover:text-foreground"
          >
            <History className="h-3.5 w-3.5" />
            {lang === "zh" ? "我的记录" : "History"}
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {east.map(renderCard)}
        </div>
      </section>
    </div>
  );
}
