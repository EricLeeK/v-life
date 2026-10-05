import { useState } from "react";
import { ArrowRight, CalendarPlus, Check, ListPlus, LoaderCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SectionDisclosure } from "@/components/ui/section-disclosure";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

/** Local review surface. Uses the same controls as the app; has no data writes. */
export default function ControlShowcase() {
  const params = new URLSearchParams(window.location.search);
  const state = params.get("state") ?? "idle";
  const focus = params.get("focus");
  const [remind, setRemind] = useState(state !== "selected");
  const [done, setDone] = useState(state === "selected");
  const [priority, setPriority] = useState("normal");
  const [expanded, setExpanded] = useState(state === "expanded");
  const [saved, setSaved] = useState(false);
  return (
    <main data-focus={focus} className="control-preview mx-auto max-w-5xl space-y-8 px-4 py-8 sm:px-8 sm:py-12">
      <header className="flex items-start justify-between gap-4">
        <div><p className="mb-2 text-xs text-muted-foreground">V-Life · 01 整理优化</p><h1 className="heading-font type-dashboard-display">组件的细节与手感</h1><p className="mt-3 text-sm text-muted-foreground">试试连续切换、键盘选择，以及展开和收起。</p></div>
        <Button variant="outline" asChild className="shrink-0"><a href="/">回到首页<ArrowRight /></a></Button>
      </header>
      <div className="grid gap-4 md:grid-cols-2">
        <section data-component="buttons" className="card-premium space-y-5 p-5">
          <h2 className="text-sm font-semibold">按钮 · 按下与确认</h2>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => setSaved(true)}>{saved ? <Check /> : <ListPlus />}{saved ? "已记录" : "记录待办"}</Button>
            <Button variant="outline"><CalendarPlus />添加日程</Button>
            <Button variant="ghost" aria-label="重置确认状态" onClick={() => setSaved(false)}><RotateCcw />重置</Button>
          </div>
          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4"><Button disabled aria-busy="true"><LoaderCircle className="animate-spin motion-reduce:animate-none" />保存中…</Button><Button variant="outline" disabled>不可用</Button><p role="status" className="text-xs text-muted-foreground">{saved ? "记录完成。" : "操作反馈保持在原位。"}</p></div>
        </section>
        <section data-component="tabs" className="card-premium space-y-5 p-5">
          <h2 className="text-sm font-semibold">页签 · 选中底板跟随内容</h2>
          <Tabs defaultValue={state === "selected" ? "week" : "today"}>
            <TabsList className="w-full"><TabsTrigger className="flex-1" value="today">今天</TabsTrigger><TabsTrigger className="flex-1" value="week">这周</TabsTrigger><TabsTrigger className="flex-1" value="all">全部</TabsTrigger></TabsList>
            <TabsContent className="min-h-14 pt-3 text-sm text-muted-foreground" value="today">把今天要做的事放在眼前。</TabsContent>
            <TabsContent className="min-h-14 pt-3 text-sm text-muted-foreground" value="week">提前看见这周的安排。</TabsContent>
            <TabsContent className="min-h-14 pt-3 text-sm text-muted-foreground" value="all">所有待办，按优先级整理。</TabsContent>
          </Tabs>
        </section>
        <section data-component="select" className="card-premium space-y-5 p-5">
          <h2 className="text-sm font-semibold">选择 · 信息层级与展开</h2>
          <label className="block space-y-2"><span className="text-xs text-muted-foreground">待办优先级</span><Select value={priority} onValueChange={setPriority} defaultOpen={state === "menu"}><SelectTrigger aria-label="待办优先级"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="urgent">紧急</SelectItem><SelectItem value="important">重要</SelectItem><SelectItem value="normal">普通</SelectItem><SelectItem value="low">低优先</SelectItem><SelectItem value="unavailable" disabled>已归档 · 不可选</SelectItem></SelectContent></Select></label>
          <Select disabled><SelectTrigger aria-label="不可用的分类"><SelectValue placeholder="暂时没有分类" /></SelectTrigger><SelectContent><SelectItem value="none">无分类</SelectItem></SelectContent></Select>
        </section>
        <section data-component="toggles" className="card-premium p-5">
          <h2 className="mb-3 text-sm font-semibold">开关与勾选 · 状态当场发生</h2>
          <label className="flex min-h-14 cursor-pointer items-center justify-between gap-3 border-b border-border"><span className="text-sm">开启日程提醒</span><Switch checked={remind} onCheckedChange={setRemind} aria-label="开启日程提醒" /></label>
          <label className="flex min-h-14 cursor-pointer items-center gap-3 border-b border-border"><Checkbox checked={done} onCheckedChange={value => setDone(value === true)} aria-label="完成本周回顾" /><span className={`text-sm transition-colors ${done ? "text-muted-foreground line-through" : ""}`}>完成本周回顾</span></label>
          <div className="flex min-h-14 items-center justify-between gap-3"><label className="flex items-center gap-3 text-sm text-muted-foreground"><Checkbox checked="indeterminate" aria-label="部分完成" aria-readonly="true" /><span>部分完成</span></label><Switch checked disabled aria-label="不可用的提醒开关" /></div>
        </section>
        <section data-component="input" className="card-premium space-y-5 p-5 md:col-span-2">
          <h2 className="text-sm font-semibold">输入 · 清楚的焦点与校验</h2>
          <div className="grid gap-5 sm:grid-cols-2"><label className="block space-y-2"><span className="text-xs text-muted-foreground">待办名称</span><Input aria-label="待办名称" aria-invalid={state === "invalid"} aria-describedby={state === "invalid" ? "preview-error" : undefined} placeholder="例如：整理本周的生活记录" />{state === "invalid" && <p id="preview-error" role="alert" className="text-xs text-destructive">请填写待办名称。</p>}<Input disabled aria-label="不可用的输入框" value="已归档的待办" readOnly /></label><label className="block space-y-2"><span className="text-xs text-muted-foreground">备注</span><Textarea aria-label="备注" placeholder="补充需要留意的细节…" /></label></div>
        </section>
      </div>
      <SectionDisclosure title="全部模块" open={expanded} onOpenChange={setExpanded} expandLabel="展开" collapseLabel="收起" count={3} actionLabel={expanded ? "收起全部模块" : "展开全部模块"}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">{["日程", "待办", "记账"].map(name => <div key={name} className="card-premium p-5"><h3 className="text-sm font-semibold">{name}</h3><p className="mt-2 text-xs text-muted-foreground">内容随着区域展开，标题保持原位。</p></div>)}</div>
      </SectionDisclosure>
    </main>
  );
}
