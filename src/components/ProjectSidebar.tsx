import { useEffect, useState } from "react";
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
import { SortableList, SortableHandle } from "@/components/sortable/SortableList";
import { useProjectTasks, useUpdateProject } from "@/hooks/useData";
import { projectProgress } from "./projects/board-model";
import { ProjectIcon } from "./projects/ProjectIcon";

function SidebarProjectProgress({ projectId, archived = false }: { projectId: string; archived?: boolean }) {
  // Subscribe to each project's existing task query, independent of selection.
  // Board edits and refetches therefore update the same source used here.
  const { data: tasks } = useProjectTasks(projectId);
  const progress = tasks ? projectProgress(tasks) : undefined;
  return (
    <div className={`${archived ? "mt-1.5" : "mt-2"} flex items-center gap-2`}>
      <div className="flex-1 h-1.5 rounded-full bg-muted">
        <div
          className={`h-full rounded-full ${archived ? "bg-cat-green" : "bg-primary/60"} transition-all`}
          style={{ width: `${progress ?? 0}%` }}
        />
      </div>
      <span className="text-[10px] font-medium text-muted-foreground w-7 text-right">{progress === undefined ? "—" : `${progress}%`}</span>
    </div>
  );
}

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
  const updateProject = useUpdateProject();
  // Optimistic per-group order until the refetch lands.
  const [override, setOverride] = useState<Record<string, string[]> | null>(null);
  useEffect(() => { setOverride(null); }, [projects]);

  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };

  // Manual order first (drag writes 0..n-1 within a group), priority tie-break.
  const byOrder = (a: (typeof projects)[number], b: (typeof projects)[number]) =>
    (a.sort_order ?? 0) - (b.sort_order ?? 0) || priorityOrder[a.priority] - priorityOrder[b.priority];

  const orderedFor = (key: string, items: typeof projects) => {
    const ov = override?.[key];
    if (!ov) return items;
    return [
      ...ov.map((id) => items.find((p) => p.id === id)).filter(Boolean),
      ...items.filter((p) => !ov.includes(p.id)),
    ];
  };

  const handleReorder = (key: string, orderedIds: string[]) => {
    setOverride((prev) => ({ ...(prev ?? {}), [key]: orderedIds }));
    orderedIds.forEach((id, idx) => {
      const p = projects.find((x) => x.id === id);
      if (p && (p.sort_order ?? 0) !== idx) updateProject.mutate({ id, sort_order: idx });
    });
  };

  const grouped = {
    active: orderedFor("active", projects.filter((p) => p.status === "active").sort(byOrder)),
    planning: orderedFor("planning", projects.filter((p) => p.status === "planning").sort(byOrder)),
    paused: orderedFor("paused", projects.filter((p) => p.status === "paused").sort(byOrder)),
    done: projects.filter((p) => p.status === "completed" || p.status === "archived").sort(byOrder),
  };

  const renderGroup = (key: string, title: string, items: typeof projects) => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-1.5">
        <h4 className="text-[11px] font-medium text-muted-foreground px-1 uppercase tracking-wider">{title} ({items.length})</h4>
        <SortableList
          items={items}
          itemId={(p) => p.id}
          onReorder={(ids) => handleReorder(key, ids)}
          className="space-y-1"
          ariaLabel={title}
          labelItem={(p) => p.name}
          renderItem={(p) => (
            <div
              className="project-sidebar-item cursor-pointer px-3 py-2.5"
              data-selected={selectedId === p.id}
              aria-current={selectedId === p.id ? "true" : undefined}
              onClick={() => onSelect(p.id)}
            >
              <div className="flex items-center gap-2">
                <SortableHandle className="shrink-0 -ml-1 p-0.5 rounded text-muted-foreground/40 hover:text-muted-foreground" />
                <ProjectIcon name={p.name} svg={p.icon_svg} />
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
              <SidebarProjectProgress projectId={p.id} />
            </div>
          )}
        />
      </div>
    );
  };

  return (
    <div className="project-sidebar w-full h-full flex flex-col p-3">
      <Button
        onClick={onAdd}
        className="w-full mb-4 bg-primary hover:bg-primary/90 text-primary-foreground text-sm h-9"
      >
        <Plus className="h-4 w-4 mr-1" />
        {t("新建项目", "New Project")}
      </Button>
      <div className="flex-1 overflow-y-auto project-scroll-region space-y-4 pr-1">
        {renderGroup("active", t("进行中", "Active"), grouped.active)}
        {renderGroup("planning", t("规划中", "Planning"), grouped.planning)}
        {renderGroup("paused", t("暂停中", "Paused"), grouped.paused)}
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
                className="project-sidebar-item cursor-pointer px-3 py-2"
                data-selected={selectedId === p.id}
                aria-current={selectedId === p.id ? "true" : undefined}
                onClick={() => onSelect(p.id)}
              >
                <div className="flex items-center gap-2">
                  <ProjectIcon name={p.name} svg={p.icon_svg} />
                  <span className="text-[13px] font-medium truncate flex-1 text-foreground">{p.name}</span>
                </div>
                <SidebarProjectProgress projectId={p.id} archived />
              </div>
            ))}
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}
