import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";

export function DailyHero(props: {
  meta: string;
  headline: string;
  body: string;
  overallPercent: number;
  lang: "zh" | "en";
  needsProfile: boolean;
}) {
  const { meta, body, overallPercent, lang, needsProfile } = props;
  return (
    <div className="card-premium overflow-hidden">
      <div className="flex items-center justify-between border-b border-[#e4e1d7] px-5 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-[#c49840]" />
          <span className="text-[14px] font-semibold text-[#1f1a14]">
            {lang === "zh" ? "今日解读" : "Today's reading"}
          </span>
        </div>
        {meta ? <span className="text-[11px] text-[#8a847a]">{meta}</span> : null}
      </div>
      <div className="grid gap-6 p-5 lg:grid-cols-[1fr_220px] lg:items-start">
        <div className="min-w-0">
          <p className="font-mono-data text-[13px] font-medium text-[#c49840]">
            {lang === "zh" ? `整体 ${overallPercent}` : `Overall ${overallPercent}`}
          </p>
          <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-[#5c564c] sm:text-[16px]">
            {body}
          </p>
          {needsProfile && (
            <Link
              to="/settings"
              className="mt-4 inline-flex items-center rounded-lg bg-[#fce0c8] px-3 py-2 text-[12px] font-medium text-[#d17847] transition-colors hover:bg-[#f5d0b0]"
            >
              {lang === "zh"
                ? "去设置填写生日 →"
                : "Add birthday in Settings →"}
            </Link>
          )}
        </div>
        <div className="rounded-lg bg-[#f4f3ee] px-4 py-4 text-center">
          <p className="text-[11px] font-medium uppercase tracking-wide text-[#8a847a]">
            {lang === "zh" ? "整体" : "Overall"}
          </p>
          <p className="mt-1 font-mono-data text-[40px] font-semibold leading-none text-[#1f1a14]">
            {overallPercent}
          </p>
        </div>
      </div>
    </div>
  );
}
