import { useMemo, useState } from "react";
import { useLang } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCivilXingcePapers } from "@/hooks/useCivilService";
import { paperTotals } from "@/lib/civilXingcePaper";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

type Filter = "all" | "mock";

export function XingceScoreCharts() {
  const { t } = useLang();
  const [filter, setFilter] = useState<Filter>("all");
  const { data: papers = [] } = useCivilXingcePapers(
    filter === "mock" ? { is_mock: true } : undefined
  );

  const chartData = useMemo(() => {
    return [...papers]
      .sort((a, b) => a.taken_date.localeCompare(b.taken_date))
      .map((p) => {
        const s = paperTotals(p);
        return {
          label: p.taken_date.slice(5),
          overall: s.overallRate,
          verbal: s.verbalRate,
          data: s.dataRate,
          judgment: s.judgmentRate,
          quantity: s.quantityRate,
          common: s.commonRate,
          score: p.total_score != null ? Number(p.total_score) : null,
          beat: p.beat_rate != null ? Number(p.beat_rate) : null,
        };
      });
  }, [papers]);

  const latest = papers.length
    ? paperTotals([...papers].sort((a, b) => b.taken_date.localeCompare(a.taken_date))[0])
    : null;

  return (
    <Card className="border-[#e4e1d7] bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-base heading-font">{t("套卷成绩趋势", "Paper score trends")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-lg bg-[#f4f3ee] p-3">
            <p className="text-[11px] text-[#8a847a]">{t("套卷数", "Papers")}</p>
            <p className="font-mono-data text-xl text-[#1f1a14] mt-0.5">{papers.length}</p>
          </div>
          <div className="rounded-lg bg-[#f4f3ee] p-3">
            <p className="text-[11px] text-[#8a847a]">{t("最近正确率", "Latest rate")}</p>
            <p className="font-mono-data text-xl text-[#1f1a14] mt-0.5">
              {latest?.overallRate != null ? `${latest.overallRate}%` : "—"}
            </p>
          </div>
          <div className="rounded-lg bg-[#f4f3ee] p-3">
            <p className="text-[11px] text-[#8a847a]">{t("判断正确率", "Judgment")}</p>
            <p className="font-mono-data text-xl text-[#1f1a14] mt-0.5">
              {latest?.judgmentRate != null ? `${latest.judgmentRate}%` : "—"}
            </p>
          </div>
        </div>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
          <TabsList className="bg-[#f4f3ee]">
            <TabsTrigger value="all">{t("全部套卷", "All")}</TabsTrigger>
            <TabsTrigger value="mock">{t("仅模考", "Mocks only")}</TabsTrigger>
          </TabsList>
        </Tabs>

        {chartData.length === 0 ? (
          <p className="text-[13px] text-[#8a847a] text-center py-8">{t("暂无数据", "No data")}</p>
        ) : (
          <>
            <div>
              <p className="text-[12px] text-[#8a847a] mb-2">{t("总正确率 / 总分 / 击败率", "Overall / Score / Beat")}</p>
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e4e1d7" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#8a847a" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#8a847a" }} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="overall" name={t("正确率%", "Rate%")} stroke="#d17847" strokeWidth={2} connectNulls />
                    <Line type="monotone" dataKey="score" name={t("总分", "Score")} stroke="#5b88b5" strokeWidth={2} connectNulls />
                    <Line type="monotone" dataKey="beat" name={t("击败%", "Beat%")} stroke="#5b8c44" strokeWidth={2} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div>
              <p className="text-[12px] text-[#8a847a] mb-2">{t("分科正确率", "Subject rates")}</p>
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e4e1d7" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#8a847a" }} />
                    <YAxis tick={{ fontSize: 11, fill: "#8a847a" }} domain={[0, 100]} />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="verbal" name={t("言语", "Verbal")} stroke="#d17847" strokeWidth={2} connectNulls dot={false} />
                    <Line type="monotone" dataKey="data" name={t("资料", "Data")} stroke="#5b88b5" strokeWidth={2} connectNulls dot={false} />
                    <Line type="monotone" dataKey="judgment" name={t("判断", "Judge")} stroke="#8b7bb8" strokeWidth={2} connectNulls dot={false} />
                    <Line type="monotone" dataKey="quantity" name={t("数量", "Qty")} stroke="#5a9da8" strokeWidth={2} connectNulls dot={false} />
                    <Line type="monotone" dataKey="common" name={t("常识", "GK")} stroke="#c49840" strokeWidth={2} connectNulls dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
