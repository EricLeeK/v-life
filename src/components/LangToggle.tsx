import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLang } from "@/contexts/LanguageContext";

export function LangToggle({ collapsed = false }: { collapsed?: boolean }) {
  const { lang, toggleLang } = useLang();
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={toggleLang}
      className="w-full justify-start gap-2 text-[#8a847a] hover:bg-[#f4f3ee] hover:text-[#1f1a14]"
    >
      <Languages className="h-4 w-4 shrink-0" />
      {!collapsed && <span>{lang === "zh" ? "English" : "中文"}</span>}
    </Button>
  );
}
