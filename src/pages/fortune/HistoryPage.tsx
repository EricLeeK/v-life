import { useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import { FortunePageHeader } from "@/components/fortune/FortunePageHeader";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLang } from "@/contexts/LanguageContext";
import { useDeleteFortuneReading, useFortuneReadings, type FortuneReadingRow } from "@/hooks/useFortune";

const TYPE_LABEL: Record<string, { zh: string; en: string }> = {
  tarot: { zh: "塔罗", en: "Tarot" },
  iching: { zh: "易经", en: "I Ching" },
  lot: { zh: "求签", en: "Lot" },
  bazi: { zh: "八字", en: "BaZi" },
  zodiac: { zh: "星座", en: "Zodiac" },
  shengxiao: { zh: "生肖", en: "Shengxiao" },
  daily: { zh: "今日", en: "Daily" },
};

export default function HistoryPage() {
  const { t, lang } = useLang();
  const { data = [], isLoading } = useFortuneReadings();
  const del = useDeleteFortuneReading();
  const [active, setActive] = useState<FortuneReadingRow | null>(null);

  return (
    <AppLayout title={t("我的记录", "My readings")}>
      <div className="space-y-8">
        <FortunePageHeader
          title={t("我的记录", "My readings")}
          subtitle={t("个人占卜历史，不社交", "Private history only")}
          backLabel={t("返回运势", "Back to Fortune")}
        />

        {isLoading && <p className="text-[13px] text-muted-foreground">{t("加载中…", "Loading…")}</p>}

        {!isLoading && data.length === 0 && (
          <div className="card-premium p-10 text-center text-[14px] text-muted-foreground">
            {t("还没有记录，去抽一次牌吧", "No readings yet — try a draw")}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {data.map((row) => {
            const label = TYPE_LABEL[row.type] || { zh: row.type, en: row.type };
            return (
              <button
                key={row.id}
                type="button"
                onClick={() => setActive(row)}
                className="card-premium p-4 text-left"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[14px] font-semibold text-foreground">
                    {lang === "zh" ? label.zh : label.en}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {new Date(row.created_at).toLocaleString()}
                  </span>
                </div>
                {row.question && (
                  <div className="mt-2 truncate text-[12px] text-[#5c564c]">{row.question}</div>
                )}
                <div className="mt-2 line-clamp-3 text-[12px] leading-relaxed text-muted-foreground">
                  {row.reading}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <Dialog open={Boolean(active)} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {active
                ? lang === "zh"
                  ? TYPE_LABEL[active.type]?.zh || active.type
                  : TYPE_LABEL[active.type]?.en || active.type
                : ""}
            </DialogTitle>
          </DialogHeader>
          {active && (
            <div className="space-y-3 text-[13px]">
              {active.question && (
                <div className="text-[#5c564c]">
                  {t("问题", "Question")}: {active.question}
                </div>
              )}
              <pre className="overflow-x-auto rounded-lg bg-muted p-3 text-[11px] text-[#5c564c]">
                {JSON.stringify(active.payload, null, 2)}
              </pre>
              <p className="text-[15px] leading-relaxed whitespace-pre-wrap text-foreground">
                {active.reading}
              </p>
              <Button
                variant="destructive"
                onClick={async () => {
                  await del.mutateAsync(active.id);
                  setActive(null);
                }}
              >
                {t("删除", "Delete")}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
