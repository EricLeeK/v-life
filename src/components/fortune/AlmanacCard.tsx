import type { AlmanacDay } from "@/lib/fortune/almanac";

export function AlmanacCard({ data, lang }: { data: AlmanacDay; lang: "zh" | "en" }) {
  return (
    <div className="rounded-xl border border-[#e4e1d7] bg-white p-3">
      <div className="text-[11px] text-[#8a847a]">{lang === "zh" ? "黄历宜忌" : "Almanac"}</div>
      <div className="mt-2 text-[12px] text-[#1f1a14]">
        <span className="text-[#2d6a4f]">{lang === "zh" ? "宜" : "Good"}</span>{" "}
        {data.yi.join(lang === "zh" ? " " : ", ")}
      </div>
      <div className="mt-1 text-[12px] text-[#1f1a14]">
        <span className="text-[#9b2226]">{lang === "zh" ? "忌" : "Avoid"}</span>{" "}
        {data.ji.join(lang === "zh" ? " " : ", ")}
      </div>
      {data.chongsha && (
        <div className="mt-2 text-[11px] text-[#8a847a]">{data.chongsha}</div>
      )}
    </div>
  );
}
