import { useState, useEffect } from "react";
import { AppLayout } from "@/components/AppLayout";
import { ProjectSidebar } from "@/components/ProjectSidebar";
import { ProjectBoard } from "@/components/ProjectBoard";
import { ProjectModal } from "@/components/ProjectModal";
import {
  useProjects,
  useCreateProject,
  useUpdateProject,
} from "@/hooks/useData";
import { useToast } from "@/hooks/use-toast";
import { useLang } from "@/contexts/LanguageContext";

export default function ProjectsPage() {
  const { data: projects = [] } = useProjects();
  const createProject = useCreateProject();
  const updateProject = useUpdateProject();
  const { toast } = useToast();
  const { t } = useLang();

  const [selectedId, setSelectedId] = useState<string | undefined>();
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<any>(null);

  useEffect(() => {
    if (projects.length > 0 && !selectedId) {
      const active = projects.find((p) => p.status === "active");
      setSelectedId(active?.id || projects[0].id);
    }
  }, [projects, selectedId]);

  const selectedProject = projects.find((p) => p.id === selectedId);

  const handleSaveProject = async (values: any) => {
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
    }
  };

  const handleEditProject = (project: any) => {
    setEditingProject(project);
    setProjectModalOpen(true);
  };

  return (
    <AppLayout title={t("项目管理", "Projects")}>
      <div className="flex h-[calc(100vh-6rem)] flex-col md:flex-row gap-0">
        <div className="h-56 md:h-auto md:w-72 shrink-0 border-b md:border-b-0 md:border-r border-border overflow-y-auto">
          <ProjectSidebar
            projects={projects}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onAdd={() => {
              setEditingProject(null);
              setProjectModalOpen(true);
            }}
            onEdit={handleEditProject}
          />
        </div>
        <div className="flex-1 min-w-0 overflow-auto">
          {selectedProject ? (
            <ProjectBoard
              project={selectedProject}
              onEditProject={() => handleEditProject(selectedProject)}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
              {t("请新建或选择一个项目", "Create or select a project")}
            </div>
          )}
        </div>
      </div>
      <ProjectModal
        open={projectModalOpen}
        onOpenChange={setProjectModalOpen}
        onSave={handleSaveProject}
        initial={editingProject}
      />
    </AppLayout>
  );
}
