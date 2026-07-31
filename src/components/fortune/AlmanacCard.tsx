import { CalendarDays } from "lucide-react";
import type { AlmanacDay } from "@/lib/fortune/almanac";

export function AlmanacCard({ data, lang }: { data: AlmanacDay; lang: "zh" | "en" }) {
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
          <span className="text-[#1f1a14]">{data.yi.join(lang === "zh" ? " · " : ", ")}</span>
        </div>
        <div>
          <span className="mr-2 inline-flex rounded-full bg-[#fce0c8] px-2 py-0.5 text-[10px] font-medium text-[#d17847]">
            {lang === "zh" ? "忌" : "Avoid"}
          </span>
          <span className="text-[#1f1a14]">{data.ji.join(lang === "zh" ? " · " : ", ")}</span>
        </div>
        {data.chongsha && (
          <p className="text-[12px] text-[#8a847a]">{data.chongsha}</p>
        )}
      </div>
    </div>
  );
}
