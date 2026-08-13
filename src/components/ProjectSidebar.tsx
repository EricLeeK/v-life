import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, ChevronDown, ChevronRight, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLang } from "@/contexts/LanguageContext";

interface ProjectSidebarProps {
  projects: any[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onEdit: (project: any) => void;
}

export function ProjectSidebar({ projects, selectedId, onSelect, onAdd, onEdit }: ProjectSidebarProps) {
  const { t } = useLang();
  const [showArchived, setShowArchived] = useState(false);

  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };

  const grouped = {
    active: projects.filter((p) => p.status === "active").sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]),
    planning: projects.filter((p) => p.status === "planning").sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]),
    paused: projects.filter((p) => p.status === "paused").sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]),
    done: projects.filter((p) => p.status === "completed" || p.status === "archived").sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]),
  };

  const priorityDot: Record<string, string> = {
    high: "bg-[#c65d4a]",
    medium: "bg-[#d17847]",
    low: "bg-[#6b9e6b]",
  };

  const renderGroup = (title: string, items: any[]) => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-1.5">
        <h4 className="text-[11px] font-medium text-muted-foreground px-1 uppercase tracking-wider">{title} ({items.length})</h4>
        <div className="space-y-1">
          {items.map((p) => (
            <div
              key={p.id}
              className={`card-premium cursor-pointer px-3 py-2.5 ${
                selectedId === p.id
                  ? "!border-primary/30 !shadow-sm bg-muted/40"
                  : ""
              }`}
              onClick={() => onSelect(p.id)}
            >
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full shrink-0 ${priorityDot[p.priority] || "bg-muted"}`} />
                <span className="text-[13px] font-medium truncate flex-1 text-foreground">{p.name}</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={t("更多操作", "More actions")}
                      className="h-6 w-6 -mr-1 text-muted-foreground hover:text-foreground"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontal className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(p); }}>
                      {t("编辑", "Edit")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary/60 transition-all"
                    style={{ width: `${p.progress || 0}%` }}
                  />
                </div>
                <span className="text-[10px] font-medium text-muted-foreground w-7 text-right">{p.progress || 0}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-full flex flex-col p-3 bg-card border-r border-border">
      <Button
        onClick={onAdd}
        className="w-full mb-4 bg-primary hover:bg-primary/90 text-primary-foreground text-sm h-9"
      >
        <Plus className="h-4 w-4 mr-1" />
        {t("新建项目", "New Project")}
      </Button>
      <div className="flex-1 overflow-y-auto scrollbar-thin space-y-4 pr-1">
        {renderGroup(t("进行中", "Active"), grouped.active)}
        {renderGroup(t("规划中", "Planning"), grouped.planning)}
        {renderGroup(t("暂停中", "Paused"), grouped.paused)}
        <Collapsible open={showArchived} onOpenChange={setShowArchived}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground hover:text-foreground text-xs min-h-[32px]">
              <span>{t("已完成 / 归档", "Completed / Archived")} ({grouped.done.length})</span>
              {showArchived ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-1.5 space-y-1">
            {grouped.done.map((p) => (
              <div
                key={p.id}
                className={`card-premium cursor-pointer px-3 py-2 ${
                  selectedId === p.id
                    ? "!border-primary/30 !shadow-sm"
                    : "opacity-70"
                }`}
                onClick={() => onSelect(p.id)}
              >
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full shrink-0 ${priorityDot[p.priority] || "bg-muted"}`} />
                  <span className="text-[13px] font-medium truncate flex-1 text-foreground">{p.name}</span>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-emerald-600 dark:bg-emerald-500 transition-all"
                      style={{ width: `${p.progress || 0}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-medium text-muted-foreground w-7 text-right">{p.progress || 0}%</span>
                </div>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}
