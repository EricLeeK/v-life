import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useLang } from "@/contexts/LanguageContext";
import { useSaveFortuneReading } from "@/hooks/useFortune";
import type { FortuneReadingType } from "@/lib/fortune/types";

export function SaveReadingButton(props: {
  type: FortuneReadingType;
  question?: string;
  payload: Record<string, unknown>;
  reading: string;
  className?: string;
}) {
  const { t } = useLang();
  const { toast } = useToast();
  const save = useSaveFortuneReading();
  const [saved, setSaved] = useState(false);

  return (
    <Button
      className={props.className}
      disabled={!props.reading || saved || save.isPending}
      onClick={async () => {
        try {
          await save.mutateAsync({
            type: props.type,
            question: props.question,
            payload: props.payload,
            reading: props.reading,
          });
          setSaved(true);
          toast({ title: t("已保存", "Saved") });
        } catch (e) {
          toast({
            title: t("保存失败", "Save failed"),
            description: e instanceof Error ? e.message : String(e),
            variant: "destructive",
          });
        }
      }}
    >
      {saved ? t("已存到记录", "Saved") : t("存到记录", "Save")}
    </Button>
  );
}
