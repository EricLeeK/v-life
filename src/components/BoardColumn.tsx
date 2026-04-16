import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

interface BoardColumnProps {
  title: string;
  count: number;
  children: React.ReactNode;
  onAdd?: () => void;
}

export function BoardColumn({ title, count, children, onAdd }: BoardColumnProps) {
  return (
    <div className="flex flex-col min-w-[260px] max-w-[260px] h-full">
      <div className="flex items-center justify-between px-1 py-2">
        <h3 className="text-sm font-medium">{title}</h3>
        <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{count}</span>
      </div>
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {children}
      </div>
      <Button variant="ghost" size="sm" className="mt-2 justify-start text-muted-foreground" onClick={onAdd}>
        <Plus className="h-4 w-4 mr-1" />
        添加
      </Button>
    </div>
  );
}
