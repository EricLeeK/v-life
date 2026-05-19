import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileNav } from "@/components/MobileNav";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDemoMode } from "@/contexts/DemoModeContext";

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
}

export function AppLayout({ children, title }: AppLayoutProps) {
  const isMobile = useIsMobile();
  const { isDemo } = useDemoMode();

  if (isMobile) {
    return (
      <div className={`min-h-screen bg-[#f4f3ee] pb-16 ${isDemo ? "pt-10" : ""}`}>
        {title && (
          <header 
            className="sticky z-30 bg-white/80 backdrop-blur-md border-b border-[#e4e1d7] px-4 h-12 flex items-center"
            style={{ top: isDemo ? '40px' : '0px' }}
          >
            <h1 className="text-base font-semibold text-[#1f1a14] heading-font">{title}</h1>
          </header>
        )}
        <main className="p-4">{children}</main>
        <MobileNav />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className={`min-h-screen flex w-full ${isDemo ? "pt-10" : ""}`}>
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 flex items-center border-b border-[#e4e1d7] px-4 gap-3 shrink-0 bg-white">
            <SidebarTrigger className="text-[#8a847a] hover:text-[#1f1a14]" />
            {title && (
              <h1 className="text-base font-semibold text-[#1f1a14]">{title}</h1>
            )}
          </header>
          <main className="flex-1 overflow-auto bg-[#f4f3ee] flex justify-center">
            <div className="w-full px-6 lg:px-10 py-6" style={{ maxWidth: '100rem' }}>
              {children}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
