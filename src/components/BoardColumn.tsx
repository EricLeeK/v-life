import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useLang } from "@/contexts/LanguageContext";

interface BoardColumnProps {
  title: string;
  count: number;
  children: React.ReactNode;
  onAdd?: () => void;
  innerRef?: React.Ref<HTMLDivElement>;
  placeholder?: React.ReactNode;
  droppableProps?: Record<string, any>;
}

export function BoardColumn({ title, count, children, onAdd, innerRef, placeholder, droppableProps }: BoardColumnProps) {
  const { t } = useLang();
  return (
    <div className="flex flex-col w-64 min-w-64 shrink-0 md:w-full md:min-w-0 md:shrink h-full" {...droppableProps}>
      <div className="flex items-center justify-between px-2 py-2 shrink-0">
        <h3 className="text-[13px] font-medium text-foreground">{title}</h3>
        <span className="text-[11px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full font-medium">{count}</span>
      </div>
      <div ref={innerRef} className="space-y-2 pr-0.5 overflow-y-auto scrollbar-thin min-h-[100px]">
        {children}
        {placeholder}
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="mt-2 shrink-0 justify-start text-muted-foreground hover:text-foreground text-xs min-h-11"
        onClick={onAdd}
      >
        <Plus className="h-3.5 w-3.5 mr-1" />
        {t("添加", "Add")}
      </Button>
    </div>
  );
}
