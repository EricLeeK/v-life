import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckSquare } from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { zhCN } from "date-fns/locale";

interface TaskCardProps {
  task: any;
  onClick?: () => void;
}

export function TaskCard({ task, onClick }: TaskCardProps) {
  const priorityColors: Record<string, string> = {
    high: "bg-destructive/20 text-destructive",
    medium: "bg-warning/20 text-warning",
    low: "bg-primary/20 text-primary",
  };

  return (
    <Card
      className="border-l-4 border-l-blue-500 cursor-pointer hover:border-primary/30 transition-colors"
      onClick={onClick}
    >
      <CardContent className="p-3">
        <div className="flex items-start gap-2 mb-2">
          <CheckSquare className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
          <span className="text-sm font-medium leading-snug flex-1">{task.title}</span>
        </div>
        {task.description && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-2 pl-6">
            {task.description}
          </p>
        )}
        <div className="flex items-center justify-between pl-6">
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">w={task.weight}</span>
            {task.priority && task.priority !== "medium" && (
              <Badge variant="secondary" className={`text-[10px] px-1 py-0 h-4 ${priorityColors[task.priority] || ""}`}>
                {task.priority === "high" ? "高" : task.priority === "low" ? "低" : "中"}
              </Badge>
            )}
          </div>
          {task.due_date && (
            <span className="text-[10px] text-muted-foreground">
              {formatDistanceToNow(parseISO(task.due_date), { addSuffix: true, locale: zhCN })}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
