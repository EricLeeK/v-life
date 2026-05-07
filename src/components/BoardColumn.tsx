import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";

interface BoardColumnProps {
  title: string;
  count: number;
  children: React.ReactNode;
  onAdd?: () => void;
}

export function BoardColumn({ title, count, children, onAdd }: BoardColumnProps) {
  const { t } = useLang();
  return (
    <div className="flex flex-col w-full h-full">
      <div className="flex items-center justify-between px-2 py-2">
        <h3 className="text-[13px] font-medium text-[#1f1a14]">{title}</h3>
        <span className="text-[11px] text-[#8a847a] bg-[#f4f3ee] px-1.5 py-0.5 rounded-full font-medium">{count}</span>
      </div>
      <div className="flex-1 space-y-2 pr-0.5">
        {children}
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="mt-2 justify-start text-[#8a847a] hover:text-[#1f1a14] text-xs h-7"
        onClick={onAdd}
      >
        <Plus className="h-3.5 w-3.5 mr-1" />
        {t("添加", "Add")}
      </Button>
    </div>
  );
}
