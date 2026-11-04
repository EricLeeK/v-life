import { Languages } from "@/components/icons/ModuleIcons";
import { Button } from "@/components/ui/button";
import { useLang } from "@/contexts/LanguageContext";

export function LangToggle({ collapsed = false }: { collapsed?: boolean }) {
  const { lang, toggleLang } = useLang();
  return (
    <Button
      variant="ghost"
      size="sm"
      aria-label={lang === "zh" ? "English" : "中文"}
      onClick={toggleLang}
      className="w-full justify-start gap-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0 text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      <Languages className="h-4 w-4 shrink-0" />
      {!collapsed && <span>{lang === "zh" ? "English" : "中文"}</span>}
    </Button>
  );
}
