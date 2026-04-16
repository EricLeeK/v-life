import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Plus, ChevronDown, ChevronRight, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ProjectSidebarProps {
  projects: any[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onEdit: (project: any) => void;
}

export function ProjectSidebar({ projects, selectedId, onSelect, onAdd, onEdit }: ProjectSidebarProps) {
  const [showArchived, setShowArchived] = useState(false);

  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };

  const grouped = {
    active: projects.filter((p) => p.status === "active").sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]),
    planning: projects.filter((p) => p.status === "planning").sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]),
    paused: projects.filter((p) => p.status === "paused").sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]),
    done: projects.filter((p) => p.status === "completed" || p.status === "archived").sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]),
  };

  const priorityDot: Record<string, string> = {
    high: "bg-destructive",
    medium: "bg-warning",
    low: "bg-success",
  };

  const renderGroup = (title: string, items: any[]) => {
    if (items.length === 0) return null;
    return (
      <div className="space-y-2">
        <h4 className="text-xs font-medium text-muted-foreground px-1">{title} ({items.length})</h4>
        <div className="space-y-2">
          {items.map((p) => (
            <Card
              key={p.id}
              className={`cursor-pointer transition-colors ${
                selectedId === p.id ? "border-primary ring-1 ring-primary" : "hover:border-primary/20"
              }`}
              onClick={() => onSelect(p.id)}
            >
              <CardContent className="p-3 relative">
                <div className="flex items-center gap-2">
                  <span className={`h-2 w-2 rounded-full ${priorityDot[p.priority] || "bg-muted"}`} />
                  <span className="text-sm font-medium truncate flex-1">{p.name}</span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 -mr-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(p); }}>
                        编辑
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <Progress value={p.progress} className="h-1.5 mt-2" />
                <p className="text-[10px] text-muted-foreground mt-1">
                  {p.target_date ? `目标 ${p.target_date.slice(0, 10)}` : "无截止日期"}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full h-full flex flex-col p-3 border-r border-border bg-card/30">
      <Button onClick={onAdd} className="w-full mb-4">
        <Plus className="h-4 w-4 mr-1" />
        新建项目
      </Button>
      <div className="flex-1 overflow-y-auto space-y-4">
        {renderGroup("进行中", grouped.active)}
        {renderGroup("规划中", grouped.planning)}
        {renderGroup("暂停中", grouped.paused)}
        <Collapsible open={showArchived} onOpenChange={setShowArchived}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground">
              <span>已完成 / 归档 ({grouped.done.length})</span>
              {showArchived ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 space-y-2">
            {grouped.done.map((p) => (
              <Card
                key={p.id}
                className={`cursor-pointer transition-colors ${
                  selectedId === p.id ? "border-primary ring-1 ring-primary" : "hover:border-primary/20"
                }`}
                onClick={() => onSelect(p.id)}
              >
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <span className={`h-2 w-2 rounded-full ${priorityDot[p.priority] || "bg-muted"}`} />
                    <span className="text-sm font-medium truncate flex-1">{p.name}</span>
                  </div>
                  <Progress value={p.progress} className="h-1.5 mt-2" />
                </CardContent>
              </Card>
            ))}
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}
