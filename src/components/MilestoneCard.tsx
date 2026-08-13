import { memo } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Flag } from "lucide-react";
import { format, parseISO } from "date-fns";
import { useLang } from "@/contexts/LanguageContext";

interface MilestoneCardProps {
  task: any;
  onToggle?: (done: boolean) => void;
  onClick?: () => void;
}

function MilestoneCardInner({ task, onToggle, onClick }: MilestoneCardProps) {
  const { t } = useLang();
  return (
    <div
      className="card-premium px-3 py-2.5 cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start gap-2">
        <div className="h-5 w-5 rounded-md bg-accent/20 flex items-center justify-center shrink-0 mt-0.5">
          <Flag className="h-3 w-3 text-accent-foreground" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold leading-snug text-foreground">{task.title}</p>
          {task.due_date && (
            <p className="text-[10px] text-muted-foreground mt-1">
              {t("截止", "Due")} {format(parseISO(task.due_date), "MM/dd")}
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
    </div>
  );
}

export const MilestoneCard = memo(MilestoneCardInner);
