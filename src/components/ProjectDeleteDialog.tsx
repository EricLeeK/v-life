import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useLang } from "@/contexts/LanguageContext";

export function ProjectDeleteDialog({ name, project = false, pending, onCancel, onConfirm }: {
  name: string | null; project?: boolean; pending: boolean; onCancel: () => void; onConfirm: () => void;
}) {
  const { t } = useLang();
  return <AlertDialog open={name !== null} onOpenChange={open => { if (!open && !pending) onCancel(); }}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{t(`删除「${name ?? ""}」？`, `Delete “${name ?? ""}”?`)}</AlertDialogTitle>
        <AlertDialogDescription>{project
          ? t("项目中的任务、习惯、里程碑和打卡记录也会一并删除，此操作无法撤销。", "Its tasks, habits, milestones and check-ins will also be deleted. This cannot be undone.")
          : t("此工作项及其相关打卡记录将被删除，此操作无法撤销。", "This item and its check-ins will be deleted. This cannot be undone.")}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter>
        <AlertDialogCancel disabled={pending}>{t("取消", "Cancel")}</AlertDialogCancel>
        <AlertDialogAction disabled={pending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={event => { event.preventDefault(); onConfirm(); }}>
          {pending ? t("删除中…", "Deleting…") : t("确认删除", "Confirm delete")}
        </AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}
