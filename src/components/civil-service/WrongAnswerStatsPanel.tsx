import { useMemo, useState } from "react";
import { format, subDays, eachDayOfInterval } from "date-fns";
import { useLang } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCivilWrongAnswers } from "@/hooks/useCivilService";
import { tagsForGroup, type SubjectGroup } from "@/lib/civilServiceSubjects";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LineChart,
  Line,
} from "recharts";

const TAG_COLORS = ["#d17847", "#5a9da8", "#5b8c44", "#8b7bb8", "#c06838", "#5b88b5", "#a89060", "#7a9e6a"];

const QUESTION_TYPE_LABELS: Record<string, { zh: string; en: string }> = {
  choice: { zh: "选择题", en: "Choice" },
  judgement: { zh: "判断题", en: "Judgement" },
  text: { zh: "文字题", en: "Text" },
};

type TrendRange = "30" | "90";

export function WrongAnswerStatsPanel({ subjectGroup }: { subjectGroup?: SubjectGroup }) {
  const { t } = useLang();
  const [trendRange, setTrendRange] = useState<TrendRange>("30");
  const { data: wrongs = [] } = useCivilWrongAnswers({ subject_group: subjectGroup });

  const today = format(new Date(), "yyyy-MM-dd");

  const summary = useMemo(() => {
    let pending = 0;
    let mastered = 0;
    let dueToday = 0;
    let overdue = 0;
    for (const w of wrongs) {
      if (w.review_status === "mastered") {
        mastered++;
        continue;
      }
      pending++;
      if (w.next_review_date) {
        if (w.next_review_date <= today) dueToday++;
        if (w.next_review_date < today) overdue++;
      }
    }
    return { total: wrongs.length, pending, mastered, dueToday, overdue };
  }, [wrongs, today]);

  const tagChartData = useMemo(() => {
    const counts = new Map<string, number>();
    for (const w of wrongs) {
      const tag = w.subject_tag?.trim() || t("未分类", "Untagged");
      counts.set(tag, (counts.get(tag) || 0) + 1);
    }

    const knownTags = subjectGroup ? tagsForGroup(subjectGroup) : [];
    const rows: { name: string; count: number }[] = [];

    for (const tag of knownTags) {
      rows.push({ name: tag, count: counts.get(tag) || 0 });
    }
    for (const [name, count] of counts) {
      if (!knownTags.includes(name)) rows.push({ name, count });
    }

    return rows.sort((a, b) => b.count - a.count);
  }, [wrongs, subjectGroup, t]);

  const typeChartData = useMemo(() => {
    const counts = new Map<string, number>();
    let untyped = 0;
    for (const w of wrongs) {
      if (w.question_type && QUESTION_TYPE_LABELS[w.question_type]) {
        counts.set(w.question_type, (counts.get(w.question_type) || 0) + 1);
      } else {
        untyped++;
      }
    }
    const rows = [...counts.entries()].map(([key, count]) => ({
      name: t(QUESTION_TYPE_LABELS[key].zh, QUESTION_TYPE_LABELS[key].en),
      count,
    }));
    if (untyped > 0) {
      rows.push({ name: t("未标注", "Untyped"), count: untyped });
    }
    return rows.sort((a, b) => b.count - a.count);
  }, [wrongs, t]);

  const trendData = useMemo(() => {
    const days = Number(trendRange);
    const now = new Date();
    const interval = eachDayOfInterval({ start: subDays(now, days - 1), end: now });
    return interval.map((d) => {
      const key = format(d, "yyyy-MM-dd");
      return {
        label: format(d, days <= 30 ? "MM/dd" : "MM/dd"),
        count: wrongs.filter((w) => w.source_date === key).length,
      };
    });
  }, [wrongs, trendRange]);

  const tagChartHeight = Math.max(140, tagChartData.filter((d) => d.count > 0).length * 32 || 32);

  if (wrongs.length === 0) {
    return (
      <Card className="border-[#e4e1d7] bg-white">
        <CardHeader className="pb-2">
          <CardTitle className="text-base heading-font">{t("错题统计", "Wrong answer stats")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-[13px] text-[#8a847a] text-center py-8">{t("暂无错题数据", "No wrong answers yet")}</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-[#e4e1d7] bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-base heading-font">{t("错题统计", "Wrong answer stats")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <StatTile label={t("总错题", "Total")} value={summary.total} />
          <StatTile label={t("待复习", "Pending")} value={summary.pending} accent="#d17847" />
          <StatTile label={t("已掌握", "Mastered")} value={summary.mastered} accent="#5b8c44" />
          <StatTile
            label={t("今日到期", "Due today")}
            value={summary.dueToday}
            sub={summary.overdue > 0 ? `${summary.overdue} ${t("逾期", "overdue")}` : undefined}
            accent="#c06838"
          />
        </div>

        <div>
          <p className="text-[12px] text-[#8a847a] mb-2">{t("板块分布", "By subject tag")}</p>
          {tagChartData.every((d) => d.count === 0) ? (
            <p className="text-[13px] text-[#8a847a] text-center py-4">{t("暂无板块数据", "No tag data")}</p>
          ) : (
            <div className="w-full" style={{ height: tagChartHeight }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={tagChartData.filter((d) => d.count > 0)}
                  layout="vertical"
                  margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e4e1d7" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: "#8a847a" }} />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={76}
                    tick={{ fontSize: 11, fill: "#1f1a14" }}
                  />
                  <Tooltip
                    formatter={(value: number) => [value, t("错题数", "Count")]}
                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e4e1d7" }}
                  />
                  <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={20}>
                    {tagChartData
                      .filter((d) => d.count > 0)
                      .map((_, i) => (
                        <Cell key={i} fill={TAG_COLORS[i % TAG_COLORS.length]} />
                      ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {typeChartData.length > 0 && (
          <div>
            <p className="text-[12px] text-[#8a847a] mb-2">{t("题型分布", "By question type")}</p>
            <div className="flex flex-wrap gap-2">
              {typeChartData.map((row, i) => (
                <div
                  key={row.name}
                  className="rounded-lg border border-[#e4e1d7] px-3 py-2 min-w-[88px]"
                  style={{ borderLeftWidth: 3, borderLeftColor: TAG_COLORS[i % TAG_COLORS.length] }}
                >
                  <p className="text-[11px] text-[#8a847a]">{row.name}</p>
                  <p className="font-mono-data text-lg text-[#1f1a14]">{row.count}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-[12px] text-[#8a847a]">{t("新增趋势", "New wrong answers")}</p>
            <Tabs value={trendRange} onValueChange={(v) => setTrendRange(v as TrendRange)}>
              <TabsList className="bg-[#f4f3ee] h-8">
                <TabsTrigger value="30" className="text-[11px] px-2 h-6">
                  {t("近30天", "30d")}
                </TabsTrigger>
                <TabsTrigger value="90" className="text-[11px] px-2 h-6">
                  {t("近90天", "90d")}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className="h-44 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e4e1d7" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "#8a847a" }}
                  interval={trendRange === "90" ? 13 : 4}
                />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "#8a847a" }} width={28} />
                <Tooltip
                  formatter={(value: number) => [value, t("新增", "New")]}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e4e1d7" }}
                />
                <Line
                  type="monotone"
                  dataKey="count"
                  name={t("新增错题", "New wrongs")}
                  stroke="#5a9da8"
                  strokeWidth={2}
                  dot={{ r: 2, fill: "#5a9da8" }}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatTile({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: number;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-lg bg-[#f4f3ee] p-3">
      <p className="text-[11px] text-[#8a847a]">{label}</p>
      <p className="font-mono-data text-xl mt-0.5" style={{ color: accent || "#1f1a14" }}>
        {value}
      </p>
      {sub && <p className="text-[10px] text-[#c06838] mt-0.5">{sub}</p>}
    </div>
  );
}
