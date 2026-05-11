import { useEffect, useState } from "react";
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

type LearningCourse = Tables<"learning_courses">;
type LearningNote = Tables<"learning_notes">;

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

export default function LearningNotesPage() {
  const { data: coursesData = [] } = useLearningCourses();
  const courses = coursesData as LearningCourse[];
  const { toast } = useToast();
  const { t } = useLang();

  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [courseModalOpen, setCourseModalOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<LearningCourse | null>(null);
  const [courseToDelete, setCourseToDelete] = useState<LearningCourse | null>(null);

  const selectedCourse = courses.find((course) => course.id === selectedId);
  const { data: notesData = [] } = useLearningNotes(selectedCourse?.id);
  const notes = notesData as LearningNote[];

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
      toast({ title: t("保存失败", "Save failed"), description: errorMessage(e), variant: "destructive" });
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
      toast({ title: t("删除失败", "Delete failed"), description: errorMessage(e), variant: "destructive" });
    }
  };

  const handleCreateNote = async (values: LearningNoteCreateValues) => {
    try {
      return await createNote.mutateAsync(values) as LearningNote;
    } catch (e: unknown) {
      toast({ title: t("创建失败", "Create failed"), description: errorMessage(e), variant: "destructive" });
      throw e;
    }
  };

  const handleSaveNote = async (values: LearningNoteSaveValues) => {
    try {
      await updateNote.mutateAsync(values);
      toast({ title: t("笔记已保存", "Note saved") });
    } catch (e: unknown) {
      toast({ title: t("保存失败", "Save failed"), description: errorMessage(e), variant: "destructive" });
      throw e;
    }
  };

  const handleDeleteNote = async (values: LearningNoteDeleteValues) => {
    try {
      await deleteNote.mutateAsync(values);
    } catch (e: unknown) {
      toast({ title: t("删除失败", "Delete failed"), description: errorMessage(e), variant: "destructive" });
    }
  };

  return (
    <AppLayout title={t("学习笔记", "Learning Notes")}>
      <div className="flex h-[calc(100vh-6rem)] flex-col md:flex-row gap-0">
        <div className="h-64 md:h-auto md:w-72 shrink-0 border-b md:border-b-0 md:border-r border-[#e4e1d7]">
          <LearningCourseSidebar
            courses={courses}
            selectedId={selectedId}
            noteCounts={selectedCourse ? { [selectedCourse.id]: notes.length } : {}}
            onSelect={setSelectedId}
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
            <div className="h-full flex items-center justify-center text-[#8a847a] text-sm">
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
