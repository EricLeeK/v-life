import { Link } from "react-router-dom";
import { StarRow, starsText } from "./StarRow";
import type { DailyScores } from "@/lib/fortune/types";

export function DailyHero(props: {
  meta: string;
  headline: string;
  body: string;
  scores: DailyScores;
  lang: "zh" | "en";
  needsProfile: boolean;
}) {
  const { meta, headline, body, scores, lang, needsProfile } = props;
  return (
    <div className="rounded-xl border border-[#e4e1d7] bg-white p-4">
      <div className="mb-2 text-[11px] text-[#8a847a]">{meta}</div>
      <div className="flex items-start gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#f0e6d8] to-[#d4c4a8] text-lg text-[#1f1a14]">
          ✦
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold text-[#1f1a14]">
            {headline.includes("★") ? headline : `${headline} ${starsText(scores.overall)}`}
          </div>
          <p className="mt-1 text-[12px] leading-relaxed text-[#5c564c]">{body}</p>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <StarRow value={scores.love} label={lang === "zh" ? "爱情" : "Love"} />
        <StarRow value={scores.career} label={lang === "zh" ? "事业" : "Career"} />
        <StarRow value={scores.wealth} label={lang === "zh" ? "财运" : "Wealth"} />
      </div>
      {needsProfile && (
        <Link
          to="/settings"
          className="mt-3 block rounded-lg bg-[#f4f3ee] px-3 py-2 text-center text-[12px] text-[#d17847]"
        >
          {lang === "zh" ? "去设置填写生日，解锁专属今日 →" : "Add birthday in Settings for a personal reading →"}
        </Link>
      )}
    </div>
  );
}
