import { Link } from "react-router-dom";

const WEST = [
  { to: "/fortune/tarot", zh: "塔罗抽牌", en: "Tarot", primary: true },
  { to: "/fortune/zodiac", zh: "星座详解", en: "Zodiac", primary: false },
];

const EAST = [
  { to: "/fortune/iching", zh: "易经起卦", en: "I Ching", primary: false },
  { to: "/fortune/lot", zh: "求签", en: "Lot", primary: false },
  { to: "/fortune/shengxiao", zh: "生肖运势", en: "Shengxiao", primary: false },
  { to: "/fortune/bazi", zh: "八字日柱", en: "BaZi", primary: false },
];

export function ToolGrid({ lang }: { lang: "zh" | "en" }) {
  return (
    <div className="space-y-4">
      <section>
        <h3 className="mb-2 text-[13px] font-semibold text-[#1f1a14]">
          {lang === "zh" ? "西式占卜" : "Western"}
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {WEST.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={
                item.primary
                  ? "rounded-xl bg-[#1f1a14] px-3 py-3.5 text-center text-[13px] text-[#faf8f4]"
                  : "rounded-xl border border-[#e4e1d7] bg-white px-3 py-3.5 text-center text-[13px] text-[#1f1a14]"
              }
            >
              {lang === "zh" ? item.zh : item.en}
            </Link>
          ))}
        </div>
      </section>
      <section>
        <h3 className="mb-2 text-[13px] font-semibold text-[#1f1a14]">
          {lang === "zh" ? "中式运势" : "Chinese"}
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {EAST.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className="rounded-xl border border-[#e4e1d7] bg-white px-3 py-3.5 text-center text-[13px] text-[#1f1a14]"
            >
              {lang === "zh" ? item.zh : item.en}
            </Link>
          ))}
        </div>
      </section>
      <Link
        to="/fortune/history"
        className="block text-center text-[12px] text-[#8a847a] underline-offset-2 hover:underline"
      >
        {lang === "zh" ? "我的记录" : "My readings"}
      </Link>
    </div>
  );
}
