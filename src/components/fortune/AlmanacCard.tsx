import { CalendarDays } from "lucide-react";
import type { AlmanacDay } from "@/lib/fortune/almanac";

export function AlmanacCard({ data, lang }: { data: AlmanacDay; lang: "zh" | "en" }) {
  const meta = [data.zhiXing && (lang === "zh" ? `建除·${data.zhiXing}` : `Jianchu·${data.zhiXing}`), data.chongsha]
    .filter(Boolean)
    .join(" · ");
  const sep = lang === "zh" ? " · " : ", ";

  return (
    <div className="card-premium h-full p-5">
      <div className="mb-3 flex items-center gap-2">
        <CalendarDays className="h-4 w-4 text-[#5b8c44]" />
        <span className="text-[14px] font-semibold text-[#1f1a14]">
          {lang === "zh" ? "黄历宜忌" : "Almanac"}
        </span>
      </div>
      <div className="space-y-3 text-[13px]">
        <div>
          <span className="mr-2 inline-flex rounded-full bg-[#dcead4] px-2 py-0.5 text-[10px] font-medium text-[#5b8c44]">
            {lang === "zh" ? "宜" : "Good"}
          </span>
          <span className="text-[#1f1a14] leading-relaxed">{data.yi.join(sep)}</span>
        </div>
        <div>
          <span className="mr-2 inline-flex rounded-full bg-[#fce0c8] px-2 py-0.5 text-[10px] font-medium text-[#d17847]">
            {lang === "zh" ? "忌" : "Avoid"}
          </span>
          <span className="text-[#1f1a14] leading-relaxed">{data.ji.join(sep)}</span>
        </div>
        {meta && <p className="text-[12px] text-[#8a847a]">{meta}</p>}
      </div>
    </div>
  );
}