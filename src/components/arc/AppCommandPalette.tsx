import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Search } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSettings } from "@/hooks/useData";
import { useLang } from "@/contexts/LanguageContext";
import { Button } from "@/vendor/uiarc/registry/components/button/button";
import { CommandPalette } from "@/vendor/uiarc/registry/components/command-palette/command-palette";
import { ArcScope } from "./ArcScope";

const routes = [
  ["/", "首页概览", "Dashboard", "今天", "Today"],
  ["/todos", "待办事项", "To-Dos", "今天", "Today"],
  ["/today", "今日待办", "Today's Todo", "今天", "Today"],
  ["/schedule", "日程计划", "Schedule", "今天", "Today"],
  ["/finance", "记账", "Finance", "生活", "Life"],
  ["/pantry", "食材管理", "Pantry", "生活", "Life"],
  ["/belongings", "用品管理", "Belongings", "生活", "Life"],
  ["/calories", "热量记录", "Calories", "生活", "Life"],
  ["/newspapers", "生活日报", "Newspapers", "生活", "Life"],
  ["/projects", "项目管理", "Projects", "成长", "Growth"],
  ["/goals", "目标", "Goals", "成长", "Growth"],
  ["/thoughts", "随想", "Thoughts", "成长", "Growth"],
  ["/learning-notes", "学习笔记", "Learning Notes", "成长", "Growth"],
  ["/weight-loss", "减肥专项", "Weight Loss", "成长", "Growth"],
  ["/civil-service", "考公", "Civil Service", "成长", "Growth"],
  ["/fortune", "运势", "Fortune", "成长", "Growth"],
  ["/settings", "设置", "Settings", "设置", "Settings"],
] as const;

export function AppCommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const { t } = useLang();
  const { data: settings } = useSettings();
  const focusMode = (settings as { app_focus_mode?: string })?.app_focus_mode ?? "full";
  const hidden = settings?.hidden_features ?? [];
  const items = routes.filter(([path]) => {
    if (path === "/settings") return true;
    return focusMode === "civil_service" ? path === "/civil-service" : !hidden.includes(path.slice(1));
  }).map(([path, zh, en, groupZh, groupEn]) => ({ id: path, label: t(zh, en), group: t(groupZh, groupEn), keywords: [zh, en, path] }));

  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, []);

  return <Dialog.Root open={open} onOpenChange={setOpen}>
    <ArcScope className="ml-auto">
      <Dialog.Trigger asChild>
        <Button variant="secondary" size="sm" aria-label={t("搜索功能", "Search functions")}>
          <Search size={16} aria-hidden="true" />
          <span>{t("搜索功能", "Search")}</span>
          <kbd className="text-xs opacity-60">⌘ K</kbd>
        </Button>
      </Dialog.Trigger>
    </ArcScope>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/30" />
      <Dialog.Content className="arc-runtime fixed left-1/2 top-[12vh] z-[61] w-[min(560px,calc(100vw-24px))] -translate-x-1/2 outline-none" onEscapeKeyDown={event => {
        // The palette clears its query on the first Esc while the input has
        // focus; only swallow Radix's close for that case so keyboard users
        // are never trapped when focus sits on a result or the close button.
        if (event.target instanceof HTMLInputElement) event.preventDefault();
      }}>
        <Dialog.Title className="sr-only">{t("搜索功能", "Search functions")}</Dialog.Title>
        <Dialog.Description className="sr-only">{t("输入名称查找功能，方向键选择，回车打开。", "Find a function, use arrow keys to select, and Enter to open.")}</Dialog.Description>
        <CommandPalette items={items} label={t("搜索功能", "Search functions")} placeholder={t("搜索待办、记账、日程…", "Search tasks, finance, schedule…")} onClose={() => setOpen(false)} onSelect={item => { setOpen(false); navigate(item.id); }} />
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
