import { useEffect, useRef, useState, type ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileNav } from "@/components/MobileNav";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { AppCommandPalette } from "@/components/arc/AppCommandPalette";
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

export function AppLayout(
  { children, title, description, actions, header = true, fullBleed = false }: AppLayoutProps,
) {
  const isMobile = useIsMobile();
  const { isDemo } = useDemoMode();
  const mainRef = useRef<HTMLElement>(null);
  const [scroller, setScroller] = useState<HTMLElement | Window | null>(null);
  const showPageHeader = !!title && header && !fullBleed;
  const scrolled = useScrolledPast(scroller);
  const barTitleVisible = !showPageHeader || scrolled;

  useEffect(() => {
    setScroller(isMobile ? window : mainRef.current);
  }, [isMobile]);

  const barTitle = title && (
    fullBleed
      ? <h1 className="text-[13px] font-medium text-muted-foreground">{title}</h1>
      : (
        <p
          className={cn(
            "text-[13px] font-medium text-muted-foreground transition-opacity duration-200",
            barTitleVisible ? "opacity-100" : "opacity-0",
          )}
          aria-hidden={!barTitleVisible || undefined}
        >
          {title}
        </p>
      )
  );

  if (isMobile) {
    return (
      <div className={`min-h-screen bg-background text-foreground pb-16 ${isDemo ? "pt-10" : ""}`}>
        {title && (
          <header
            className="sticky z-30 bg-background/90 backdrop-blur-md border-b border-border px-4 h-12 flex items-center"
            style={{ top: isDemo ? "40px" : "0px" }}
          >
            {barTitle}
            <AppCommandPalette />
          </header>
        )}
        <main className="p-4">
          {showPageHeader && <PageHeader title={title!} description={description} actions={actions} />}
          {children}
        </main>
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
            {barTitle}
            <AppCommandPalette />
          </header>
          <main ref={mainRef} className="flex-1 min-h-0 overflow-auto bg-background flex justify-center">
            {fullBleed ? (
              <div className="w-full h-full">
                {children}
              </div>
            ) : (
              <div className="w-full px-6 lg:px-10 py-6" style={{ maxWidth: "100rem" }}>
                {showPageHeader && <PageHeader title={title!} description={description} actions={actions} />}
                {children}
              </div>
            )}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
