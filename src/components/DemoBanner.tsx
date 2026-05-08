import { useDemoMode } from "@/contexts/DemoModeContext";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export function DemoBanner() {
  const { isDemo, exitDemo } = useDemoMode();
  const navigate = useNavigate();

  if (!isDemo) return null;

  const handleExit = () => {
    exitDemo();
    navigate("/auth", { replace: true });
  };

  return (
    <div className="sticky top-0 z-50 w-full bg-amber-50 border-b border-amber-200 px-4 py-2 flex items-center justify-between">
      <span className="text-sm text-amber-800 font-medium">
        🎭 游览模式 — 数据为演示用途
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
