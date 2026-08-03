import { useMemo, useState } from "react";
import { format, subDays, startOfWeek, startOfMonth, eachDayOfInterval, eachWeekOfInterval, eachMonthOfInterval } from "date-fns";
import { useLang } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCivilCheckins, useCivilWrongAnswers } from "@/hooks/useCivilService";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

type Range = "day" | "week" | "month";

export function CivilStatsCharts({ subjectGroup }: { subjectGroup?: string }) {
  const { t } = useLang();
  const [range, setRange] = useState<Range>("day");
  const { data: checkins = [] } = useCivilCheckins();
  const { data: wrongs = [] } = useCivilWrongAnswers({ subject_group: subjectGroup });

  const chartData = useMemo(() => {
    const now = new Date();
    if (range === "day") {
      const days = eachDayOfInterval({ start: subDays(now, 29), end: now });
      return days.map((d) => {
        const key = format(d, "yyyy-MM-dd");
        const c = checkins.find((x) => x.date === key);
        const wrongCount = wrongs.filter((w) => w.source_date === key).length;
        return {
          label: format(d, "MM/dd"),
          minutes: c?.studied_minutes || 0,
          checkin: c ? 1 : 0,
          wrongs: wrongCount,
        };
      });
    }
    if (range === "week") {
      const start = subDays(now, 12 * 7);
      const weeks = eachWeekOfInterval({ start, end: now }, { weekStartsOn: 1 });
      return weeks.map((w) => {
        const weekStart = startOfWeek(w, { weekStartsOn: 1 });
        const weekEnd = subDays(weekStart, -6);
        const weekDays = eachDayOfInterval({ start: weekStart, end: weekEnd > now ? now : weekEnd });
        const keys = new Set(weekDays.map((d) => format(d, "yyyy-MM-dd")));
        const minutes = checkins.filter((c) => keys.has(c.date)).reduce((s, c) => s + c.studied_minutes, 0);
        const checkinDays = checkins.filter((c) => keys.has(c.date)).length;
        const wrongCount = wrongs.filter((w) => keys.has(w.source_date)).length;
        return {
          label: format(weekStart, "MM/dd"),
          minutes,
          checkin: checkinDays,
          wrongs: wrongCount,
        };
      });
    }
    // month
    const start = startOfMonth(subDays(now, 365));
    const months = eachMonthOfInterval({ start, end: now });
    return months.map((m) => {
      const prefix = format(m, "yyyy-MM");
      const minutes = checkins.filter((c) => c.date.startsWith(prefix)).reduce((s, c) => s + c.studied_minutes, 0);
      const checkinDays = checkins.filter((c) => c.date.startsWith(prefix)).length;
      const wrongCount = wrongs.filter((w) => w.source_date.startsWith(prefix)).length;
      return {
        label: format(m, "yyyy/MM"),
        minutes,
        checkin: checkinDays,
        wrongs: wrongCount,
      };
    });
  }, [range, checkins, wrongs]);

  const today = format(new Date(), "yyyy-MM-dd");
  const totalMinutes = checkins.reduce((s, c) => s + c.studied_minutes, 0);
  const totalCheckinDays = checkins.length;
  const totalWrongs = wrongs.length;
  const pendingWrongs = wrongs.filter((w) => w.review_status === "pending").length;
  const overdueWrongs = wrongs.filter(
    (w) => w.review_status === "pending" && w.next_review_date && w.next_review_date < today
  ).length;

  return (
    <Card className="border-[#e4e1d7] bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-base heading-font">{t("学习统计", "Study stats")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-[#f4f3ee] p-3">
            <p className="text-[11px] text-[#8a847a]">{t("总时长(分)", "Minutes")}</p>
            <p className="font-mono-data text-xl text-[#1f1a14] mt-0.5">{totalMinutes}</p>
          </div>
          <div className="rounded-lg bg-[#f4f3ee] p-3">
            <p className="text-[11px] text-[#8a847a]">{t("打卡天数", "Check-in days")}</p>
            <p className="font-mono-data text-xl text-[#1f1a14] mt-0.5">{totalCheckinDays}</p>
          </div>
          <div className="rounded-lg bg-[#f4f3ee] p-3">
            <p className="text-[11px] text-[#8a847a]">{t("错题", "Wrongs")}</p>
            <p className="font-mono-data text-xl text-[#1f1a14] mt-0.5">
              {totalWrongs}
              <span className="text-[11px] text-[#8a847a] font-sans ml-1">
                ({pendingWrongs} {t("待复习", "pending")}
                {overdueWrongs > 0 ? ` · ${overdueWrongs} ${t("逾期", "overdue")}` : ""})
              </span>
            </p>
          </div>
        </div>

        <Tabs value={range} onValueChange={(v) => setRange(v as Range)}>
          <TabsList className="bg-[#f4f3ee]">
            <TabsTrigger value="day">{t("日", "Day")}</TabsTrigger>
            <TabsTrigger value="week">{t("周", "Week")}</TabsTrigger>
            <TabsTrigger value="month">{t("月", "Month")}</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e4e1d7" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#8a847a" }} />
              <YAxis tick={{ fontSize: 11, fill: "#8a847a" }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="minutes" name={t("时长", "Minutes")} stroke="#d17847" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="checkin" name={t("打卡", "Check-in")} stroke="#5b8c44" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="wrongs" name={t("错题", "Wrongs")} stroke="#5a9da8" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
