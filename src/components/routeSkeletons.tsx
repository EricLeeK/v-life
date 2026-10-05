import type { ReactNode } from "react";
import { useLang } from "@/contexts/LanguageContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export type SkeletonKind =
  | "dashboard"
  | "schedule"
  | "todos"
  | "today"
  | "finance"
  | "calories"
  | "pantry"
  | "belongings"
  | "goals"
  | "thoughts"
  | "workspace"
  | "weight"
  | "civil"
  | "civil-group"
  | "settings"
  | "newspaper"
  | "shop"
  | "fortune"
  | "fortune-reading"
  | "fortune-history"
  | "list";

export type RouteSkeletonSpec = {
  kind: SkeletonKind;
  titleZh: string;
  titleEn: string;
  statusZh: string;
  statusEn: string;
  header: boolean;
  fullBleed: boolean;
  description: boolean;
};

const ROUTES: Array<RouteSkeletonSpec & { match: (pathname: string) => boolean }> = [
  { match: (p) => p === "/", kind: "dashboard", titleZh: "首页概览", titleEn: "Dashboard", statusZh: "正在加载首页", statusEn: "Loading the dashboard", header: false, fullBleed: false, description: false },
  { match: (p) => p.startsWith("/schedule"), kind: "schedule", titleZh: "日程计划", titleEn: "Schedule", statusZh: "正在加载日程", statusEn: "Loading the schedule", header: true, fullBleed: false, description: false },
  { match: (p) => p.startsWith("/todos"), kind: "todos", titleZh: "待办事项", titleEn: "To-Dos", statusZh: "正在加载待办事项", statusEn: "Loading to-dos", header: true, fullBleed: false, description: false },
  { match: (p) => p.startsWith("/today"), kind: "today", titleZh: "今日待办", titleEn: "Today's Todo", statusZh: "正在加载今日待办", statusEn: "Loading today's to-dos", header: true, fullBleed: false, description: false },
  { match: (p) => p.startsWith("/finance"), kind: "finance", titleZh: "记账", titleEn: "Finance", statusZh: "正在加载记账", statusEn: "Loading finance", header: true, fullBleed: false, description: false },
  { match: (p) => p.startsWith("/calories"), kind: "calories", titleZh: "热量记录", titleEn: "Calories", statusZh: "正在加载热量记录", statusEn: "Loading calories", header: true, fullBleed: false, description: false },
  { match: (p) => p.startsWith("/pantry"), kind: "pantry", titleZh: "食材管理", titleEn: "Pantry", statusZh: "正在加载食材", statusEn: "Loading the pantry", header: true, fullBleed: false, description: true },
  { match: (p) => p.startsWith("/belongings"), kind: "belongings", titleZh: "用品管理", titleEn: "Belongings", statusZh: "正在加载用品", statusEn: "Loading belongings", header: true, fullBleed: false, description: true },
  { match: (p) => p.startsWith("/goals"), kind: "goals", titleZh: "目标", titleEn: "Goals", statusZh: "正在加载目标", statusEn: "Loading goals", header: true, fullBleed: false, description: true },
  { match: (p) => p.startsWith("/thoughts"), kind: "thoughts", titleZh: "随想", titleEn: "Thoughts", statusZh: "正在加载随想", statusEn: "Loading thoughts", header: true, fullBleed: false, description: false },
  { match: (p) => p.startsWith("/projects"), kind: "workspace", titleZh: "项目管理", titleEn: "Projects", statusZh: "正在加载项目", statusEn: "Loading projects", header: true, fullBleed: true, description: false },
  { match: (p) => p.startsWith("/learning-notes"), kind: "workspace", titleZh: "学习笔记", titleEn: "Learning Notes", statusZh: "正在加载学习笔记", statusEn: "Loading learning notes", header: true, fullBleed: true, description: false },
  { match: (p) => p.startsWith("/weight-loss"), kind: "weight", titleZh: "减肥专项", titleEn: "Weight Loss", statusZh: "正在加载减肥专项", statusEn: "Loading weight loss", header: true, fullBleed: false, description: false },
  { match: (p) => /^\/civil-service\/.+/.test(p), kind: "civil-group", titleZh: "考公", titleEn: "Civil Service", statusZh: "正在加载考公科目", statusEn: "Loading the exam subject", header: true, fullBleed: false, description: false },
  { match: (p) => p.startsWith("/civil-service"), kind: "civil", titleZh: "考公", titleEn: "Civil Service", statusZh: "正在加载考公", statusEn: "Loading civil service", header: true, fullBleed: false, description: false },
  { match: (p) => p.startsWith("/settings"), kind: "settings", titleZh: "设置", titleEn: "Settings", statusZh: "正在加载设置", statusEn: "Loading settings", header: true, fullBleed: false, description: false },
  { match: (p) => p.startsWith("/newspapers"), kind: "newspaper", titleZh: "生活日报", titleEn: "Life newspaper", statusZh: "正在加载生活日报", statusEn: "Loading the newspaper", header: false, fullBleed: false, description: false },
  { match: (p) => p.startsWith("/shop"), kind: "shop", titleZh: "商店", titleEn: "Shop", statusZh: "正在加载商店", statusEn: "Loading the shop", header: true, fullBleed: false, description: false },
  { match: (p) => p.startsWith("/fortune/history"), kind: "fortune-history", titleZh: "我的记录", titleEn: "My readings", statusZh: "正在加载运势记录", statusEn: "Loading fortune history", header: false, fullBleed: false, description: false },
  { match: (p) => p.startsWith("/fortune/"), kind: "fortune-reading", titleZh: "运势", titleEn: "Fortune", statusZh: "正在加载占卜", statusEn: "Loading the reading", header: false, fullBleed: false, description: false },
  { match: (p) => p.startsWith("/fortune"), kind: "fortune", titleZh: "运势", titleEn: "Fortune", statusZh: "正在加载运势", statusEn: "Loading fortune", header: false, fullBleed: false, description: false },
];

const FALLBACK: RouteSkeletonSpec = {
  kind: "list",
  titleZh: "页面",
  titleEn: "Page",
  statusZh: "正在加载页面",
  statusEn: "Loading this page",
  header: true,
  fullBleed: false,
  description: false,
};

export function routeSkeletonSpec(pathname: string): RouteSkeletonSpec {
  return ROUTES.find((route) => route.match(pathname)) ?? FALLBACK;
}

export function isFullBleedPath(pathname: string) {
  return routeSkeletonSpec(pathname).fullBleed;
}

function Bone({ className }: { className?: string }) {
  return <Skeleton className={cn("bg-muted", className)} />;
}

function TitleBones({ description }: { description?: boolean }) {
  return (
    <div className="flex items-end justify-between gap-4 pb-6 pt-2">
      <div className="space-y-2">
        <Bone className="h-8 w-40" />
        {description && <Bone className="h-4 w-72 max-w-full" />}
      </div>
      <Bone className="h-9 w-24 shrink-0" />
    </div>
  );
}

function Rows({ count, className }: { count: number; className?: string }) {
  return (
    <div className={cn("space-y-3", className)}>
      {Array.from({ length: count }, (_, index) => <Bone key={index} className="h-12 w-full" />)}
    </div>
  );
}

function SkeletonBody({ kind }: { kind: SkeletonKind }) {
  switch (kind) {
    case "dashboard":
      return (
        <div className="space-y-8">
          <div className="space-y-2">
            <Bone className="h-10 w-56" />
            <Bone className="h-4 w-40" />
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.8fr)]">
            <Bone className="h-44 w-full" />
            <Bone className="h-44 w-full" />
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => <Bone key={index} className="h-16 w-full" />)}
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Bone className="h-64 w-full" />
            <Bone className="h-64 w-full" />
          </div>
        </div>
      );
    case "schedule":
      return (
        <div className="space-y-4">
          <div className="flex gap-2">
            <Bone className="h-9 w-9" />
            <Bone className="h-9 w-16" />
            <Bone className="h-9 w-9" />
            <Bone className="ml-auto h-9 w-48" />
          </div>
          <Bone className="h-[28rem] w-full" />
        </div>
      );
    case "todos":
      return (
        <div className="mx-auto max-w-6xl space-y-5">
          <Bone className="h-12 w-full" />
          <Bone className="h-4 w-24" />
          <Rows count={4} />
          <Bone className="h-4 w-24" />
          <Rows count={3} />
        </div>
      );
    case "today":
      return (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
          <Bone className="h-48 w-full" />
          <Rows count={5} />
        </div>
      );
    case "finance":
      return (
        <div className="space-y-4">
          <div className="flex gap-2">
            <Bone className="h-9 w-28" />
            <Bone className="ml-auto h-9 w-24" />
          </div>
          <div className="grid gap-4 xl:grid-cols-[14rem_32rem_minmax(0,1fr)]">
            <Bone className="h-28 w-full" />
            <Bone className="h-56 w-full" />
            <Rows count={5} />
          </div>
        </div>
      );
    case "calories":
      return (
        <div className="space-y-4">
          <div className="flex gap-2">
            {Array.from({ length: 5 }, (_, index) => <Bone key={index} className="h-9 w-16" />)}
          </div>
          <Bone className="h-28 w-full max-w-md" />
          <Rows count={4} />
        </div>
      );
    case "pantry":
      return (
        <div className="space-y-6">
          <div className="flex gap-3">
            <Bone className="h-10 max-w-md flex-1" />
            <Bone className="h-10 w-56" />
          </div>
          <Rows count={6} />
        </div>
      );
    case "belongings":
      return (
        <div className="space-y-4">
          <div className="flex gap-2">
            <Bone className="h-10 w-28" />
            <Bone className="h-10 w-28" />
            <Bone className="h-10 w-28" />
          </div>
          <Rows count={5} />
        </div>
      );
    case "goals":
      return (
        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => <Rows key={index} count={4} />)}
        </div>
      );
    case "thoughts":
      return (
        <div className="space-y-4">
          <div className="flex gap-2">
            {Array.from({ length: 4 }, (_, index) => <Bone key={index} className="h-8 w-20" />)}
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {Array.from({ length: 4 }, (_, index) => <Bone key={index} className="h-32 w-full" />)}
          </div>
        </div>
      );
    case "workspace":
      return (
        <div className="flex h-full min-h-0 flex-1 flex-col md:flex-row">
          <div className="space-y-3 border-b border-border p-4 md:w-72 md:shrink-0 md:border-b-0 md:border-r">
            <Bone className="h-8 w-32" />
            <Rows count={6} />
          </div>
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 p-4 md:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => <Bone key={index} className="h-full min-h-64 w-full" />)}
          </div>
        </div>
      );
    case "weight":
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Bone className="h-36 w-full" />
            <Bone className="h-36 w-full" />
          </div>
          <Bone className="h-56 w-full" />
          <Rows count={3} />
        </div>
      );
    case "civil":
      return (
        <div className="space-y-4">
          <Bone className="h-32 w-full" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {Array.from({ length: 3 }, (_, index) => <Bone key={index} className="h-24 w-full" />)}
          </div>
          <Rows count={4} />
        </div>
      );
    case "civil-group":
      return (
        <div className="space-y-4">
          <Bone className="h-8 w-28" />
          <Bone className="h-40 w-full" />
          <Rows count={5} />
        </div>
      );
    case "settings":
      return (
        <div className="space-y-8">
          <div className="flex gap-2">
            {Array.from({ length: 6 }, (_, index) => <Bone key={index} className="h-9 w-16" />)}
          </div>
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="space-y-3">
              <Bone className="h-5 w-32" />
              <Bone className="h-24 w-full" />
            </div>
          ))}
        </div>
      );
    case "newspaper":
      return (
        <div className="space-y-6">
          <div className="space-y-2">
            <Bone className="h-10 w-48" />
            <Bone className="h-4 w-72 max-w-full" />
          </div>
          <Bone className="mx-auto h-[32rem] w-full max-w-3xl" />
        </div>
      );
    case "shop":
      return (
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="grid grid-cols-3 gap-3">
            {Array.from({ length: 3 }, (_, index) => <Bone key={index} className="h-20 w-full" />)}
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => <Bone key={index} className="h-40 w-full" />)}
          </div>
        </div>
      );
    case "fortune":
      return (
        <div className="space-y-8">
          <div className="space-y-2">
            <Bone className="h-12 w-56" />
            <Bone className="h-4 w-40" />
          </div>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => <Bone key={index} className="h-28 w-full" />)}
          </div>
        </div>
      );
    case "fortune-reading":
      return (
        <div className="space-y-6">
          <Bone className="h-10 w-48" />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
            <Bone className="h-72 w-full" />
            <Bone className="h-72 w-full" />
          </div>
        </div>
      );
    case "fortune-history":
      return (
        <div className="space-y-4">
          <Bone className="h-10 w-40" />
          <Rows count={6} />
        </div>
      );
    default:
      return <Rows count={6} />;
  }
}

function Status({ pathname, className, children }: { pathname: string; className?: string; children: ReactNode }) {
  const spec = routeSkeletonSpec(pathname);
  const { t } = useLang();
  return (
    <div role="status" aria-busy="true" aria-live="polite" aria-label={t(spec.statusZh, spec.statusEn)} data-skeleton={spec.kind} className={className}>
      {children}
    </div>
  );
}

export function RouteSkeleton({ pathname }: { pathname: string }) {
  const spec = routeSkeletonSpec(pathname);
  const isMobile = useIsMobile();
  const showTitle = spec.header && !spec.fullBleed;
  const bleed = !isMobile && spec.fullBleed;
  return (
    <div className={bleed ? "flex h-full min-h-0 w-full flex-col" : isMobile ? "w-full p-4" : "w-full px-6 py-6 lg:px-10"} style={bleed || isMobile ? undefined : { maxWidth: "100rem" }}>
      <Status pathname={pathname} className={bleed ? "flex h-full min-h-0 flex-col" : undefined}>
        {showTitle && <TitleBones description={spec.description} />}
        <SkeletonBody kind={spec.kind} />
      </Status>
    </div>
  );
}

export function RouteSkeletonBody({ pathname }: { pathname: string }) {
  const spec = routeSkeletonSpec(pathname);
  return (
    <Status pathname={pathname}>
      <SkeletonBody kind={spec.kind} />
    </Status>
  );
}

/** No private-data hooks: safe to render while the account is still unknown. */
export function AppLoadingSkeleton({ pathname }: { pathname: string }) {
  return (
    <div className="flex min-h-screen bg-background text-foreground" data-auth-loading>
      <aside aria-hidden="true" className="hidden w-64 shrink-0 space-y-8 border-r border-border p-4 md:block">
        <div className="flex h-8 items-center gap-2"><img src="/v-life-icon.svg" alt="" className="h-8 w-8" /><span className="font-semibold">V-Life</span></div>
        <Rows count={8} />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div aria-hidden="true" className="flex h-12 shrink-0 items-center border-b border-border px-4"><Bone className="h-5 w-24" /></div>
        <main className="flex min-h-0 flex-1 justify-center pb-16 md:pb-0"><RouteSkeleton pathname={pathname} /></main>
      </div>
    </div>
  );
}
