import { Pencil, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLang } from "@/contexts/LanguageContext";

export function ProjectEditActions({ name, onEdit, onDelete }: { name: string; onEdit: () => void; onDelete: () => void }) {
  const { t } = useLang();
  return <div role="group" aria-label={t(`${name}的操作`, `Actions for ${name}`)} className="flex shrink-0 items-center justify-end gap-0.5" onClick={event => event.stopPropagation()} onKeyDown={event => event.stopPropagation()}>
    <Button variant="ghost" size="icon" className="h-7 w-7 [&_svg]:size-3.5 text-muted-foreground" aria-label={t(`编辑${name}`, `Edit ${name}`)} title={t("编辑", "Edit")} onClick={onEdit}>
      <Pencil className="h-3.5 w-3.5" />
    </Button>
    <Button variant="ghost" size="icon" className="h-7 w-7 [&_svg]:size-3.5 text-destructive hover:bg-destructive/10 hover:text-destructive" aria-label={t(`删除${name}`, `Delete ${name}`)} title={t("删除", "Delete")} onClick={onDelete}>
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  </div>;
}
