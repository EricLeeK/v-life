import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { PrepPaper } from "@/hooks/usePreparation";
export function PaperTrends({ papers }: { papers: PrepPaper[] }) {
  const data = [...papers]
    .sort((a, b) => a.taken_date.localeCompare(b.taken_date))
    .map((p) => ({
      ...p,
      label: p.taken_date,
      accuracy:
        p.sections.reduce((s, x) => s + x.total, 0) > 0
          ? Math.round(
              (100 * p.sections.reduce((s, x) => s + x.correct, 0)) /
                p.sections.reduce((s, x) => s + x.total, 0),
            )
          : null,
    }));
  if (data.length < 2) return null;
  return (
    <details className="border-y border-border py-3">
      <summary className="cursor-pointer min-h-11 font-medium">
        模考趋势 · {data.length} 次记录
      </summary>
      <div className="h-64 min-w-0" role="img" aria-label="总分与用时趋势">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--card))",
                borderColor: "hsl(var(--border))",
              }}
            />
            <Legend />
            <Line
              connectNulls={false}
              dataKey="total_score"
              name="总分"
              stroke="hsl(var(--chart-1))"
            />
            <Line
              connectNulls={false}
              dataKey="duration_minutes"
              name="用时（分钟）"
              stroke="hsl(var(--chart-2))"
            />
            <Line
              dataKey="accuracy"
              name="正确率（%）"
              stroke="hsl(var(--chart-3))"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="text-left py-3 text-muted-foreground">
            各分项正确率
          </caption>
          <thead>
            <tr>
              <th className="text-left p-2">日期</th>
              {[
                ...new Set(data.flatMap((p) => p.sections.map((s) => s.name))),
              ].map((name) => (
                <th key={name} className="p-2 whitespace-nowrap">
                  {name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((p) => (
              <tr key={p.id} className="border-t border-border">
                <td className="p-2 whitespace-nowrap">{p.label}</td>
                {[
                  ...new Set(
                    data.flatMap((p) => p.sections.map((s) => s.name)),
                  ),
                ].map((name) => {
                  const s = p.sections.find((s) => s.name === name);
                  return (
                    <td key={name} className="p-2 text-center">
                      {s?.total
                        ? `${Math.round((100 * s.correct) / s.total)}%`
                        : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
