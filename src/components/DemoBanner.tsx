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
    <div className="fixed top-0 left-0 right-0 h-10 z-[100] w-full bg-foreground text-background px-4 flex items-center justify-between gap-3">
      <span className="min-w-0 text-xs sm:text-[13px] flex items-center gap-2">
        <Compass className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
        <span className="sm:hidden">{t("游览模式 · 数据不保存", "Demo · data isn't saved")}</span>
        <span className="hidden sm:inline">{t("游览模式 · 页面中的数据均为演示，不会保存", "Tour mode · demo data, nothing is saved")}</span>
      </span>
      <Button
        size="sm"
        variant="ghost"
        data-compact="true"
        className="h-7 shrink-0 px-2 text-xs text-background hover:bg-background/10 hover:text-background border border-background/25"
        onClick={handleExit}
      >
        {t("注册开始", "Sign up")}
      </Button>
    </div>
  );
}
