import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { Suspense } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileNav } from "@/components/MobileNav";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { useLang } from "@/contexts/LanguageContext";
import { AppCommandPalette } from "@/components/arc/AppCommandPalette";
import { RouteLoadBoundary } from "@/components/RouteLoadBoundary";
import { RouteSkeleton, isFullBleedPath, routeSkeletonSpec } from "@/components/routeSkeletons";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
  /** One line under the title: what this page is for. */
  description?: ReactNode;
  /** Primary page actions, aligned with the title. */
  actions?: ReactNode;
  /** Pages that draw their own level-one heading (home greeting, archive, fortune) turn this off. */
  header?: boolean;
  /** 工作台页面（学习笔记/项目管理）使用：内容贴满主区域，与顶部导航一体，无内边距 */
  fullBleed?: boolean;
}

type PageChrome = {
  mounted: boolean;
  title?: string;
  header: boolean;
  fullBleed: boolean;
};

const EMPTY_CHROME: PageChrome = { mounted: false, header: true, fullBleed: false };

const AppShellContext = createContext<{ setChrome: (chrome: PageChrome) => void } | null>(null);

function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="page-header">
      <div className="min-w-0">
        <h1 className="heading-font text-foreground">{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </header>
  );
}

/** The bar title stays hidden while the page's own large title is on screen. */
function useScrolledPast(target: HTMLElement | Window | null, offset = 56) {
  const [past, setPast] = useState(false);
  useEffect(() => {
    if (!target) return;
    const read = () => {
      const y = target instanceof Window ? target.scrollY : target.scrollTop;
      setPast(y > offset);
    };
    read();
    target.addEventListener("scroll", read, { passive: true });
    return () => target.removeEventListener("scroll", read);
  }, [target, offset]);
  return past;
}

function PageFrame({
  children, title, description, actions, header = true, fullBleed = false,
}: AppLayoutProps) {
  const isMobile = useIsMobile();
  const showPageHeader = !!title && header && !fullBleed;
  if (!isMobile && fullBleed) {
    return <div className="h-full w-full">{children}</div>;
  }
  return (
    <div className={isMobile ? "w-full p-4" : "w-full px-6 py-6 lg:px-10"} style={isMobile ? undefined : { maxWidth: "100rem" }}>
      {showPageHeader && <PageHeader title={title!} description={description} actions={actions} />}
      {children}
    </div>
  );
}

function BarTitle({ title, visible, asHeading }: { title?: string; visible: boolean; asHeading?: boolean }) {
  if (!title) return null;
  const className = cn(
    "text-[13px] font-medium text-muted-foreground transition-opacity duration-200",
    asHeading ? "" : visible ? "opacity-100" : "opacity-0",
  );
  if (asHeading) return <h1 className={className}>{title}</h1>;
  return <p className={className} aria-hidden={!visible || undefined}>{title}</p>;
}

function AppChrome({
  children, title, showPageHeader, fullBleed, barAsHeading, mainRef,
}: {
  children: ReactNode;
  title?: string;
  showPageHeader: boolean;
  fullBleed: boolean;
  barAsHeading: boolean;
  mainRef: RefObject<HTMLElement | null>;
}) {
  const isMobile = useIsMobile();
  const { isDemo } = useDemoMode();
  const [scroller, setScroller] = useState<HTMLElement | Window | null>(null);
  const scrolled = useScrolledPast(scroller);
  const barTitleVisible = !showPageHeader || scrolled;

  useEffect(() => {
    setScroller(isMobile ? window : mainRef.current);
  }, [isMobile, mainRef]);

  const bar = <BarTitle title={title} visible={barTitleVisible} asHeading={barAsHeading} />;

  if (isMobile) {
    return (
      <div className={`min-h-screen bg-background text-foreground pb-16 ${isDemo ? "pt-10" : ""}`}>
        <header
          className="sticky z-30 bg-background/90 backdrop-blur-md border-b border-border px-4 h-12 flex items-center"
          style={{ top: isDemo ? "40px" : "0px" }}
        >
          {bar}
          <AppCommandPalette />
        </header>
        <main>{children}</main>
        <MobileNav />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className={`${fullBleed ? "h-screen" : "min-h-screen"} flex w-full bg-background text-foreground ${isDemo ? "pt-10" : ""}`}>
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center border-b border-border px-4 gap-3 shrink-0 bg-background">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
            {bar}
            <AppCommandPalette />
          </header>
          <main ref={mainRef} className={`flex-1 min-h-0 overflow-auto bg-background ${fullBleed ? "" : "flex justify-center"}`}>
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function ShellOutlet() {
  const { pathname } = useLocation();
  return (
    <RouteLoadBoundary key={pathname}>
      <Suspense fallback={<RouteSkeleton pathname={pathname} />}>
        <Outlet />
      </Suspense>
    </RouteLoadBoundary>
  );
}

export function AppShell({ pending = false }: { pending?: boolean }) {
  const { pathname } = useLocation();
  const { t } = useLang();
  const isMobile = useIsMobile();
  const mainRef = useRef<HTMLElement>(null);
  const [chrome, setChromeState] = useState<PageChrome>(EMPTY_CHROME);
  const setChrome = useCallback((next: PageChrome) => {
    setChromeState((prev) => (
      prev.mounted === next.mounted && prev.title === next.title && prev.header === next.header && prev.fullBleed === next.fullBleed
        ? prev
        : next
    ));
  }, []);
  const shell = useMemo(() => ({ setChrome }), [setChrome]);
  const spec = routeSkeletonSpec(pathname);
  const title = chrome.mounted ? chrome.title : t(spec.titleZh, spec.titleEn);
  const header = chrome.mounted ? chrome.header : spec.header;
  const pageFullBleed = chrome.mounted ? chrome.fullBleed : isFullBleedPath(pathname);
  const fullBleed = !isMobile && pageFullBleed;
  const showPageHeader = !!title && header && !pageFullBleed;

  return (
    <AppShellContext.Provider value={shell}>
      <AppChrome title={title} showPageHeader={showPageHeader} fullBleed={fullBleed} barAsHeading={pageFullBleed} mainRef={mainRef}>
        {pending ? <RouteSkeleton pathname={pathname} /> : <ShellOutlet />}
      </AppChrome>
    </AppShellContext.Provider>
  );
}

export function AppLayout({
  children, title, description, actions, header = true, fullBleed = false,
}: AppLayoutProps) {
  const shell = useContext(AppShellContext);
  const isMobile = useIsMobile();
  const mainRef = useRef<HTMLElement>(null);
  const setChrome = shell?.setChrome;

  useLayoutEffect(() => {
    if (!setChrome) return;
    setChrome({ mounted: true, title, header, fullBleed });
    return () => setChrome(EMPTY_CHROME);
  }, [setChrome, title, header, fullBleed]);

  const frame = (
    <PageFrame title={title} description={description} actions={actions} header={header} fullBleed={fullBleed}>
      {children}
    </PageFrame>
  );

  if (shell) return frame;

  const showPageHeader = !!title && header && !fullBleed;
  return (
    <AppChrome title={title} showPageHeader={showPageHeader} fullBleed={!isMobile && fullBleed} barAsHeading={fullBleed} mainRef={mainRef}>
      {frame}
    </AppChrome>
  );
}
