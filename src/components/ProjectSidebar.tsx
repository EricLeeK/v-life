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
        <h4 className="text-[11px] font-medium text-[#8a847a] px-1 uppercase tracking-wider">{title} ({items.length})</h4>
        <div className="space-y-1">
          {items.map((p) => (
            <div
              key={p.id}
              className={`card-premium cursor-pointer px-3 py-2.5 ${
                selectedId === p.id
                  ? "!border-[#1f1a14]/20 !shadow-[0_1px_4px_rgba(0,0,0,0.06)]"
                  : ""
              }`}
              onClick={() => onSelect(p.id)}
            >
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 rounded-full shrink-0 ${priorityDot[p.priority] || "bg-[#d4d1c7]"}`} />
                <span className="text-[13px] font-medium truncate flex-1 text-[#1f1a14]">{p.name}</span>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 -mr-1 text-[#8a847a] hover:text-[#1f1a14]"
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
                <div className="flex-1 h-1.5 rounded-full bg-[#e4e1d7]">
                  <div
                    className="h-full rounded-full bg-[#1f1a14]/40 transition-all"
                    style={{ width: `${p.progress || 0}%` }}
                  />
                </div>
                <span className="text-[10px] font-medium text-[#8a847a] w-7 text-right">{p.progress || 0}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-full flex flex-col p-3 bg-white">
      <Button
        onClick={onAdd}
        className="w-full mb-4 bg-[#1f1a14] hover:bg-[#1f1a14]/90 text-white text-sm h-9"
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
            <Button variant="ghost" size="sm" className="w-full justify-between text-[#8a847a] hover:text-[#1f1a14] text-xs h-7">
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
                    ? "!border-[#1f1a14]/20 !shadow-[0_1px_4px_rgba(0,0,0,0.06)]"
                    : "opacity-70"
                }`}
                onClick={() => onSelect(p.id)}
              >
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full shrink-0 ${priorityDot[p.priority] || "bg-[#d4d1c7]"}`} />
                  <span className="text-[13px] font-medium truncate flex-1 text-[#1f1a14]">{p.name}</span>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-[#e4e1d7]">
                    <div
                      className="h-full rounded-full bg-[#6b9e6b] transition-all"
                      style={{ width: `${p.progress || 0}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-medium text-[#8a847a] w-7 text-right">{p.progress || 0}%</span>
                </div>
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}
