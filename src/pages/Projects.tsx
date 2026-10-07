import { moduleFigure } from "@/components/concepts/catalog";
import { EmptyState } from "@/components/ui/empty-state";
import { CollectionFeedback } from "@/components/concepts/CollectionFeedback";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { ProjectSidebar } from "@/components/ProjectSidebar";
import { ProjectBoard } from "@/components/ProjectBoard";
import { ProjectModal } from "@/components/ProjectModal";
import { ProjectDeleteDialog } from "@/components/ProjectDeleteDialog";
import {
  useProjects,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
} from "@/hooks/useData";
import { useToast } from "@/hooks/use-toast";
import { useLang } from "@/contexts/LanguageContext";
import type { Tables } from "@/integrations/supabase/types";

export default function ProjectsPage() {
  const { data: projects = [], isLoading, error, refetch } = useProjects();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const deleteProject = useDeleteProject();
  const { toast } = useToast();
  const { t } = useLang();

  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<any>(null);
  const [editMode, setEditMode] = useState(false);
  const [deletingProject, setDeletingProject] = useState<Tables<"projects"> | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (projects.length > 0 && !projects.some(project => project.id === selectedId)) {
      const active = projects.find((p) => p.status === "active");
      setSelectedId(active?.id || projects[0].id);
    }
  }, [projects, selectedId]);

  const selectedProject = projects.find((p) => p.id === selectedId);

  const handleSaveProject = async (values: any) => {
    if (saving) return;
    setSaving(true);
    try {
      if (editingProject) {
        await updateProject.mutateAsync({ id: editingProject.id, ...values });
      } else {
        const data = await createProject.mutateAsync(values);
        if (data?.id) setSelectedId(data.id);
      }
      setProjectModalOpen(false);
      setEditingProject(null);
    } catch (e: any) {
      toast({ title: t("保存失败", "Save failed"), description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!deletingProject || deleting) return;
    setDeleting(true);
    try {
      await deleteProject.mutateAsync(deletingProject.id);
      if (selectedId === deletingProject.id) {
        const remaining = projects.filter(project => project.id !== deletingProject.id);
        setSelectedId(remaining.find(project => project.status === "active")?.id ?? remaining[0]?.id);
      }
      setDeletingProject(null);
    } catch (error) {
      toast({ title: t("删除失败", "Delete failed"), description: error instanceof Error ? error.message : String(error), variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const handleEditProject = (project: any) => {
    setEditingProject(project);
    setProjectModalOpen(true);
  };

  return (
    <AppLayout title={t("项目管理", "Projects")} fullBleed>
      <div className="flex h-full flex-col md:flex-row gap-0">
        {projects.length > 0 && <div className="flex items-center gap-3 border-b border-border bg-card p-3 md:hidden">
          <label className="sr-only" htmlFor="mobile-project">{t("选择项目", "Select project")}</label>
          <select id="mobile-project" value={selectedId ?? ""} onChange={event => setSelectedId(event.target.value)} className="min-h-11 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-base text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
            {projects.map(project => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
          <Button className="min-h-11 shrink-0" onClick={() => { setEditingProject(null); setProjectModalOpen(true); }}>{t("新建", "New")}</Button>
        </div>}
        {projects.length > 0 && <div className="hidden md:block md:w-72 shrink-0 border-r border-border overflow-y-auto">
          <ProjectSidebar
            projects={projects}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onAdd={() => {
              setEditingProject(null);
              setProjectModalOpen(true);
            }}
            onEdit={handleEditProject}
            editMode={editMode}
            onDelete={setDeletingProject}
          />
        </div>}
        <div className="flex-1 min-w-0 overflow-auto">
          {selectedProject ? (
            <ProjectBoard
              key={selectedProject.id}
              project={selectedProject}
              onEditProject={() => handleEditProject(selectedProject)}
              onDeleteProject={() => setDeletingProject(selectedProject)}
              editMode={editMode}
              onToggleEditMode={() => setEditMode(value => !value)}
            />
          ) : (
            <div className="flex min-h-96 h-full items-center justify-center">
              <CollectionFeedback loading={isLoading} error={error} retry={refetch}>
                <EmptyState figure={moduleFigure.projects} title={t("把一个想法，拆成可完成的事", "Build an idea, one layer at a time")}
                  hint={t("新建项目，用任务、习惯和里程碑推进它。", "Create a project and move it forward with tasks, habits and milestones.")}
                  action={<Button onClick={() => { setEditingProject(null); setProjectModalOpen(true); }}>{t("新建项目", "Create a project")}</Button>} />
              </CollectionFeedback>
            </div>
          )}
        </div>
      </div>
      <ProjectModal
        open={projectModalOpen}
        onOpenChange={setProjectModalOpen}
        onSave={handleSaveProject}
        initial={editingProject}
        pending={saving}
      />
      <ProjectDeleteDialog name={deletingProject?.name ?? null} project pending={deleting} onCancel={() => setDeletingProject(null)} onConfirm={handleDeleteProject} />
    </AppLayout>
  );
}
