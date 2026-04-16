import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Flag } from "lucide-react";
import { format, parseISO } from "date-fns";

interface MilestoneCardProps {
  task: any;
  onToggle?: (done: boolean) => void;
  onClick?: () => void;
}

export function MilestoneCard({ task, onToggle, onClick }: MilestoneCardProps) {
  return (
    <Card
      className="border-l-4 border-l-amber-500 cursor-pointer hover:border-primary/30 transition-colors"
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="flex items-start gap-2">
          <Flag className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold leading-snug">{task.title}</p>
            {task.due_date && (
              <p className="text-[10px] text-muted-foreground mt-1">
                截止 {format(parseISO(task.due_date), "MM/dd")}
              </p>
            )}
          </div>
          <Checkbox
            checked={task.status === "done"}
            onCheckedChange={(v) => {
              if (onToggle) onToggle(v as boolean);
            }}
            onClick={(e) => e.stopPropagation()}
            className="shrink-0"
          />
        </div>
      </CardContent>
    </Card>
  );
}
