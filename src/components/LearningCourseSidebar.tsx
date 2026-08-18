import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BookOpen, GripVertical, MoreHorizontal, Plus } from "lucide-react";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { useLang } from "@/contexts/LanguageContext";
import type { Tables } from "@/integrations/supabase/types";

type LearningCourse = Tables<"learning_courses">;

interface LearningCourseSidebarProps {
  courses: LearningCourse[];
  selectedId?: string;
  noteCounts?: Record<string, number>;
  onSelect: (id: string) => void;
  onAdd: () => void;
  onEdit: (course: LearningCourse) => void;
  onDelete: (course: LearningCourse) => void;
  onReorder?: (courses: LearningCourse[]) => void;
}

export function LearningCourseSidebar({
  courses,
  selectedId,
  noteCounts = {},
  onSelect,
  onAdd,
  onEdit,
  onDelete,
  onReorder,
}: LearningCourseSidebarProps) {
  const { t } = useLang();

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination || result.destination.index === result.source.index) return;
    const reordered = Array.from(courses);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    onReorder?.(reordered);
  };

  return (
    <div className="w-full h-full flex flex-col p-3 bg-card border-r border-border">
      <Button
        onClick={onAdd}
        className="w-full mb-4 bg-primary hover:bg-primary/90 text-primary-foreground text-sm h-9"
      >
        <Plus className="h-4 w-4 mr-1" />
        {t("新建课程", "New Course")}
      </Button>

      <div className="flex-1 overflow-y-auto scrollbar-thin pr-1">
        {courses.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4 text-muted-foreground">
            <BookOpen className="h-8 w-8 mb-2 opacity-60" />
            <p className="text-sm font-medium text-foreground">{t("还没有课程", "No courses yet")}</p>
            <p className="text-xs mt-1">{t("先创建一个课程，再添加学习笔记。", "Create a course first, then add notes.")}</p>
          </div>
        ) : (
          <DragDropContext onDragEnd={handleDragEnd}>
            <Droppable droppableId="learning-courses">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                  {courses.map((course, index) => (
                    <Draggable key={course.id} draggableId={course.id} index={index}>
                      {(dragProvided, snapshot) => (
                        <div
                          ref={dragProvided.innerRef}
                          {...dragProvided.draggableProps}
                          className={`card-premium cursor-pointer px-3 py-2.5 ${
                            selectedId === course.id
                              ? "!border-primary/30 !shadow-sm bg-muted/40"
                              : ""
                          } ${snapshot.isDragging ? "ring-1 ring-primary/25 shadow-raised z-20" : ""}`}
                          onClick={() => onSelect(course.id)}
                        >
                          <div className="flex items-center gap-2">
                            <div
                              {...dragProvided.dragHandleProps}
                              aria-label={t("拖拽调整课程顺序", "Drag to reorder course")}
                              title={t("拖拽调整顺序", "Drag to reorder")}
                              className="shrink-0 -ml-1 p-0.5 rounded text-muted-foreground/40 hover:text-muted-foreground cursor-grab active:cursor-grabbing"
                            >
                              <GripVertical className="h-3.5 w-3.5" />
                            </div>
                            <span
                              className="h-2.5 w-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: course.color || "#5b88b5" }}
                            />
                            <span className="text-[13px] font-medium truncate flex-1 text-foreground">{course.name}</span>
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
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(course); }}>
                                  {t("编辑", "Edit")}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onClick={(e) => { e.stopPropagation(); onDelete(course); }}
                                >
                                  {t("删除", "Delete")}
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          {course.description && (
                            <p className="mt-1.5 text-[11px] text-muted-foreground line-clamp-2">{course.description}</p>
                          )}
                          {noteCounts[course.id] !== undefined && (
                            <p className="mt-2 text-[10px] text-muted-foreground">
                              {t(`${noteCounts[course.id]} 条笔记`, `${noteCounts[course.id]} notes`)}
                            </p>
                          )}
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
        )}
      </div>
    </div>
  );
}
