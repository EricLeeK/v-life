import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/AppLayout";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { LearningCourseModal, type LearningCourseFormValues } from "@/components/LearningCourseModal";
import { LearningCourseSidebar } from "@/components/LearningCourseSidebar";
import {
  LearningNotePanel,
  type LearningNoteCreateValues,
  type LearningNoteDeleteValues,
  type LearningNoteSaveOptions,
  type LearningNoteSaveValues,
} from "@/components/LearningNotePanel";
import {
  useCreateLearningCourse,
  useCreateLearningNote,
  useDeleteLearningCourse,
  useDeleteLearningNote,
  useLearningCourses,
  useLearningNotes,
  useUpdateLearningCourse,
  useUpdateLearningNote,
} from "@/hooks/useData";
import { useToast } from "@/hooks/use-toast";
import { useLang } from "@/contexts/LanguageContext";
import type { Tables } from "@/integrations/supabase/types";
import { getErrorMessage } from "@/lib/errorMessage";

type LearningCourse = Tables<"learning_courses">;
type LearningNote = Tables<"learning_notes">;

const COURSE_ORDER_KEY = "vlife-learning-course-order";

function loadCourseOrder(): string[] {
  try {
    const raw = localStorage.getItem(COURSE_ORDER_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "string") : [];
  } catch {
    return [];
  }
}

export default function LearningNotesPage() {
  const { data: coursesData = [] } = useLearningCourses();
  const courses = coursesData as LearningCourse[];
  const { toast } = useToast();
  const { t } = useLang();

  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [courseOrder, setCourseOrder] = useState<string[]>(loadCourseOrder);
  const [courseModalOpen, setCourseModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<LearningCourse | null>(null);
  const [courseToDelete, setCourseToDelete] = useState<LearningCourse | null>(null);

  const selectedCourse = courses.find((course) => course.id === selectedId);
  const { data: notesData = [] } = useLearningNotes(selectedCourse?.id);
  const notes = notesData as LearningNote[];

  // 已保存的拖拽排序优先；新增课程（未在排序中）排在最前
  const orderedCourses = useMemo(() => {
    if (courseOrder.length === 0) return courses;
    const inOrder = courseOrder
      .map((id) => courses.find((course) => course.id === id))
      .filter((course): course is LearningCourse => Boolean(course));
    const fresh = courses.filter((course) => !courseOrder.includes(course.id));
    return [...fresh, ...inOrder];
  }, [courses, courseOrder]);

  const handleReorderCourses = (reordered: LearningCourse[]) => {
    const ids = reordered.map((course) => course.id);
    setCourseOrder(ids);
    try {
      localStorage.setItem(COURSE_ORDER_KEY, JSON.stringify(ids));
    } catch {
      // localStorage 不可用时仅保留本次会话内的排序
    }
  };

  const createCourse = useCreateLearningCourse();
  const updateCourse = useUpdateLearningCourse();
  const deleteCourse = useDeleteLearningCourse();
  const createNote = useCreateLearningNote();
  const updateNote = useUpdateLearningNote();
  const deleteNote = useDeleteLearningNote();

  useEffect(() => {
    if (courses.length > 0 && !selectedId) {
      setSelectedId(courses[0].id);
    }
    if (selectedId && courses.length > 0 && !courses.some((course) => course.id === selectedId)) {
      setSelectedId(courses[0].id);
    }
  }, [courses, selectedId]);

  const handleSaveCourse = async (values: LearningCourseFormValues) => {
    try {
      if (editingCourse) {
        await updateCourse.mutateAsync({ id: editingCourse.id, ...values });
      } else {
        const data = await createCourse.mutateAsync(values) as LearningCourse | undefined;
        if (data?.id) setSelectedId(data.id);
      }
      setCourseModalOpen(false);
      setEditingCourse(null);
    } catch (e: unknown) {
      toast({ title: t("保存失败", "Save failed"), description: getErrorMessage(e), variant: "destructive" });
    }
  };

  const handleDeleteCourse = async (course: LearningCourse) => {
    try {
      await deleteCourse.mutateAsync(course.id);
      if (selectedId === course.id) {
        setSelectedId(undefined);
      }
      setCourseToDelete(null);
    } catch (e: unknown) {
      toast({ title: t("删除失败", "Delete failed"), description: getErrorMessage(e), variant: "destructive" });
    }
  };

  const handleCreateNote = async (values: LearningNoteCreateValues) => {
    try {
      return await createNote.mutateAsync(values) as LearningNote;
    } catch (e: unknown) {
      toast({ title: t("创建失败", "Create failed"), description: getErrorMessage(e), variant: "destructive" });
      throw e;
    }
  };

  const handleSaveNote = async (values: LearningNoteSaveValues, options?: LearningNoteSaveOptions) => {
    try {
      await updateNote.mutateAsync(values);
      if (options?.source !== "auto") {
        toast({ title: t("笔记已保存", "Note saved") });
      }
    } catch (e: unknown) {
      toast({ title: t("保存失败", "Save failed"), description: getErrorMessage(e), variant: "destructive" });
      throw e;
    }
  };

  const handleDeleteNote = async (values: LearningNoteDeleteValues) => {
    try {
      await deleteNote.mutateAsync(values);
    } catch (e: unknown) {
      toast({ title: t("删除失败", "Delete failed"), description: getErrorMessage(e), variant: "destructive" });
    }
  };

  return (
    <AppLayout title={t("学习笔记", "Learning Notes")} fullBleed>
      <div className="flex h-full flex-col md:flex-row gap-0">
        <div className="h-64 md:h-auto md:w-72 shrink-0 border-b md:border-b-0 md:border-r border-border">
          <LearningCourseSidebar
            courses={orderedCourses}
            selectedId={selectedId}
            noteCounts={selectedCourse ? { [selectedCourse.id]: notes.length } : {}}
            onSelect={setSelectedId}
            onReorder={handleReorderCourses}
            onAdd={() => {
              setEditingCourse(null);
              setCourseModalOpen(true);
            }}
            onEdit={(course) => {
              setEditingCourse(course);
              setCourseModalOpen(true);
            }}
            onDelete={setCourseToDelete}
          />
        </div>
        <div className="flex-1 min-w-0 min-h-0">
          {selectedCourse ? (
            <LearningNotePanel
              course={selectedCourse}
              notes={notes}
              onCreateNote={handleCreateNote}
              onSaveNote={handleSaveNote}
              onDeleteNote={handleDeleteNote}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
              {t("请新建或选择一个课程", "Create or select a course")}
            </div>
          )}
        </div>
      </div>
      <LearningCourseModal
        open={courseModalOpen}
        onOpenChange={setCourseModalOpen}
        onSave={handleSaveCourse}
        initial={editingCourse}
      />
      <AlertDialog open={!!courseToDelete} onOpenChange={(open) => !open && setCourseToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("删除课程？", "Delete course?")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                `这会删除「${courseToDelete?.name || ""}」以及其中所有学习笔记，无法撤销。`,
                `This will delete "${courseToDelete?.name || ""}" and all of its learning notes. This cannot be undone.`,
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("取消", "Cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => courseToDelete && handleDeleteCourse(courseToDelete)}
            >
              {t("确认删除", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
