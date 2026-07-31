import type { MoonPhaseInfo } from "@/lib/fortune/moon";

export function MoonCard({ data, lang }: { data: MoonPhaseInfo; lang: "zh" | "en" }) {
  return (
    <div className="rounded-xl border border-[#e4e1d7] bg-white p-3">
      <div className="text-[11px] text-[#8a847a]">{lang === "zh" ? "月相" : "Moon"}</div>
      <div className="mt-1 text-2xl text-[#1f1a14]">☽</div>
      <div className="mt-1 text-[13px] font-medium text-[#1f1a14]">
        {lang === "zh" ? data.phaseZh : data.phaseEn}
      </div>
      <div className="mt-1 text-[12px] text-[#5c564c]">
        {lang === "zh" ? data.blurbZh : data.blurbEn}
      </div>
    </div>
  );
}
