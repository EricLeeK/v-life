import { useDemoMode } from "@/contexts/DemoModeContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Compass } from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";

export function DemoBanner() {
  const { isDemo, exitDemo } = useDemoMode();
  const navigate = useNavigate();
  const { t } = useLang();

  if (!isDemo) return null;

  const handleExit = () => {
    exitDemo();
    navigate("/auth", { replace: true });
  };

  return (
    <div className="sticky top-0 z-50 w-full bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between">
      <span className="text-sm text-amber-800 font-medium flex items-center gap-1.5">
        <Compass className="h-4 w-4" />
        {t("游览模式 — 数据为演示用途", "Tour Mode — Demo data only")}
      </span>
      <Button
        size="sm"
        variant="outline"
        className="border-amber-300 text-amber-800 hover:bg-amber-100 h-7 text-xs"
        onClick={handleExit}
      >
        注册开始
      </Button>
    </div>
  );
}
