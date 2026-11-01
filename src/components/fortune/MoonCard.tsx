import { Paragraph } from "@/components/ui/typography";
import { Moon } from "lucide-react";
import type { MoonPhaseInfo } from "@/lib/fortune/moon";

export function MoonCard({ data, lang }: { data: MoonPhaseInfo; lang: "zh" | "en" }) {
  return (
    <div className="card-premium h-full p-5">
      <div className="mb-3 flex items-center gap-2">
        <Moon className="h-4 w-4 text-[#8b7bb8]" />
        <span className="text-[14px] font-semibold text-foreground">
          {lang === "zh" ? "月相" : "Moon"}
        </span>
      </div>
      <Paragraph className="font-mono-data text-[28px] font-semibold text-foreground">
        {lang === "zh" ? data.phaseZh : data.phaseEn}
      </Paragraph>
      <Paragraph className="mt-1 font-mono-data text-[12px] text-muted-foreground">
        {lang === "zh"
          ? `亮度 ${Math.round(data.illumination * 100)}%`
          : `${Math.round(data.illumination * 100)}% lit`}
      </Paragraph>
      <Paragraph className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
        {lang === "zh" ? data.blurbZh : data.blurbEn}
      </Paragraph>
    </div>
  );
}
