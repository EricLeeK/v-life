import { CheckSquare } from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { zhCN } from "date-fns/locale";
import { useLang } from "@/contexts/LanguageContext";

interface TaskCardProps {
  task: any;
  onClick?: () => void;
}

export function TaskCard({ task, onClick }: TaskCardProps) {
  const { t, lang } = useLang();
  const priorityDot: Record<string, string> = {
    high: "bg-[#c65d4a]",
    medium: "bg-[#d17847]",
    low: "bg-[#6b9e6b]",
  };

  return (
    <div
      className="card-premium px-3 py-2.5 cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start gap-2 mb-1.5">
        <div className="h-5 w-5 rounded-md bg-[#e1eaf4] flex items-center justify-center shrink-0 mt-0.5">
          <CheckSquare className="h-3 w-3 text-[#5b88b5]" />
        </div>
        <span className="text-[13px] font-medium leading-snug flex-1 text-[#1f1a14]">{task.title}</span>
      </div>
      {task.description && (
        <p className="text-[11px] text-[#8a847a] line-clamp-2 mb-1.5 pl-7">
          {task.description}
        </p>
      )}
      <div className="flex items-center justify-between pl-7">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-[#8a847a] font-mono">w={task.weight}</span>
          {task.priority && task.priority !== "medium" && (
            <span className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
              task.priority === "high"
                ? "bg-[#fce0c8] text-[#c65d4a]"
                : "bg-[#e1eaf4] text-[#5b88b5]"
            }`}>
              <span className={`h-1 w-1 rounded-full ${priorityDot[task.priority]}`} />
              {task.priority === "high" ? t("高", "High") : t("低", "Low")}
            </span>
          )}
        </div>
        {task.due_date && (
          <span className="text-[10px] text-[#8a847a]">
            {formatDistanceToNow(parseISO(task.due_date), { addSuffix: true, locale: lang === "zh" ? zhCN : undefined })}
          </span>
        )}
      </div>
    </div>
  );
}
