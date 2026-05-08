import { useMemo } from "react";
import { useLang } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { ChartTooltip } from "./ChartTooltip";

interface ScheduleEvent {
  start_time: string;
  end_time: string;
  color?: string | null;
  title: string;
}

export function ScheduleAnalysis({ events }: { events: ScheduleEvent[] }) {
  const { t, lang } = useLang();

  const data = useMemo(() => {
    // Group by color, count events, sum hours
    const groups: Record<string, { hours: number; count: number; titles: string[] }> = {};
    events.forEach((e) => {
      const start = new Date(e.start_time).getTime();
      const end = new Date(e.end_time).getTime();
      const hours = Math.max(0, (end - start) / (1000 * 60 * 60));
      const color = e.color || "#c49840";
      if (!groups[color]) groups[color] = { hours: 0, count: 0, titles: [] };
      groups[color].hours += hours;
      groups[color].count++;
      if (groups[color].titles.length < 2) groups[color].titles.push(e.title);
    });

    return Object.entries(groups)
      .map(([color, g]) => {
        // Label: show first 1-2 event titles, truncated
        const label = g.titles.join(", ");
        const displayLabel = label.length > 12 ? label.slice(0, 12) + "…" : label;
        return {
          name: `${displayLabel} ×${g.count}`,
          hours: Number(g.hours.toFixed(1)),
          color,
          count: g.count,
        };
      })
      .sort((a, b) => b.hours - a.hours);
  }, [events]);

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
            <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#1f1a14" }} tickLine={false} axisLine={false} width={110} />
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
