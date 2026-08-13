import { useState, useEffect } from "react";
import { useLang } from "@/contexts/LanguageContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTodayCivilCheckin, useUpsertCivilCheckin } from "@/hooks/useCivilService";
import { useToast } from "@/hooks/use-toast";
import { Clock } from "lucide-react";

export function CheckinCard() {
  const { t } = useLang();
  const { toast } = useToast();
  const { data: checkin } = useTodayCivilCheckin();
  const upsert = useUpsertCivilCheckin();
  const [minutes, setMinutes] = useState("");

  useEffect(() => {
    if (checkin) setMinutes(String(checkin.studied_minutes));
  }, [checkin]);

  const handleSave = async () => {
    const n = parseInt(minutes, 10);
    if (Number.isNaN(n) || n < 0) {
      toast({ title: t("请输入有效分钟数", "Enter valid minutes"), variant: "destructive" });
      return;
    }
    await upsert.mutateAsync({ studied_minutes: n });
    toast({ title: t("打卡已保存", "Check-in saved") });
  };

  return (
    <Card className="border-border bg-white">
      <CardHeader className="pb-2">
        <CardTitle className="text-base heading-font flex items-center gap-2">
          <Clock className="h-4 w-4 text-[#d17847]" />
          {t("今日学习时长", "Today's study time")}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex items-center gap-2">
        <Input
          type="number"
          min={0}
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          placeholder="0"
          className="max-w-[120px] font-mono-data"
        />
        <span className="text-sm text-muted-foreground">{t("分钟", "min")}</span>
        <Button size="sm" onClick={handleSave} className="bg-[#d17847] hover:bg-[#c06838] text-white ml-auto">
          {checkin ? t("更新打卡", "Update") : t("打卡", "Check in")}
        </Button>
      </CardContent>
    </Card>
  );
}
