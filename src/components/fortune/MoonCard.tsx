import { Moon } from "lucide-react";
import type { MoonPhaseInfo } from "@/lib/fortune/moon";

export function MoonCard({ data, lang }: { data: MoonPhaseInfo; lang: "zh" | "en" }) {
  return (
    <div className="card-premium h-full p-5">
      <div className="mb-3 flex items-center gap-2">
        <Moon className="h-4 w-4 text-[#8b7bb8]" />
        <span className="text-[14px] font-semibold text-[#1f1a14]">
          {lang === "zh" ? "月相" : "Moon"}
        </span>
      </div>
      <p className="font-mono-data text-[28px] font-semibold text-[#1f1a14]">
        {lang === "zh" ? data.phaseZh : data.phaseEn}
      </p>
      <p className="mt-1 font-mono-data text-[12px] text-[#8a847a]">
        {lang === "zh"
          ? `亮度 ${Math.round(data.illumination * 100)}%`
          : `${Math.round(data.illumination * 100)}% lit`}
      </p>
      <p className="mt-2 text-[13px] leading-relaxed text-[#5c564c]">
        {lang === "zh" ? data.blurbZh : data.blurbEn}
      </p>
    </div>
  );
}
