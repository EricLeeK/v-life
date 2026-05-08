import { useMemo } from "react";
import { useLang } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { ChartTooltip } from "./ChartTooltip";

const COLOR_MAP: Record<string, string> = {
  blue: "#5b88b5",
  green: "#5b8c44",
  orange: "#d17847",
  purple: "#8b7bb8",
  teal: "#5a9da8",
  yellow: "#c49840",
  red: "#ef4444",
};

const CATEGORY_LABELS: Record<string, { zh: string; en: string }> = {
  blue: { zh: "课程", en: "Classes" },
  green: { zh: "日常", en: "Routine" },
  orange: { zh: "健身", en: "Fitness" },
  purple: { zh: "社交", en: "Social" },
  teal: { zh: "学习", en: "Study" },
  yellow: { zh: "其他", en: "Other" },
};

interface ScheduleEvent {
  start_time: string;
  end_time: string;
  color?: string | null;
  title: string;
}

export function ScheduleAnalysis({ events }: { events: ScheduleEvent[] }) {
  const { t, lang } = useLang();

  const data = useMemo(() => {
    const hoursByColor: Record<string, number> = {};
    events.forEach((e) => {
      const start = new Date(e.start_time).getTime();
      const end = new Date(e.end_time).getTime();
      const hours = Math.max(0, (end - start) / (1000 * 60 * 60));
      const color = e.color || "yellow";
      hoursByColor[color] = (hoursByColor[color] || 0) + hours;
    });

    return Object.entries(hoursByColor)
      .map(([color, hours]) => {
        const label = CATEGORY_LABELS[color];
        return {
          name: label ? (lang === "zh" ? label.zh : label.en) : color,
          hours: Number(hours.toFixed(1)),
          color: COLOR_MAP[color] || COLOR_MAP.yellow,
        };
      })
      .sort((a, b) => b.hours - a.hours);
  }, [events, lang]);

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">{t("时间分配", "Time Distribution")}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground text-center py-6">{t("暂无数据", "No data")}</p>
        </CardContent>
      </Card>
    );
  }

  const totalHours = data.reduce((s, d) => s + d.hours, 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">{t("时间分配", "Time Distribution")}</CardTitle>
          <span className="text-xs text-muted-foreground font-mono-data">{totalHours.toFixed(1)}h</span>
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={Math.max(120, data.length * 36)}>
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
            <XAxis type="number" tick={{ fontSize: 10, fill: "#8a847a" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}h`} />
            <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#1f1a14" }} tickLine={false} axisLine={false} width={60} />
            <Tooltip content={<ChartTooltip formatter={(v) => `${v}h`} />} />
            <Bar dataKey="hours" radius={[0, 4, 4, 0]} barSize={16}>
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
