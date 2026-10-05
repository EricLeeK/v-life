import { lazy, Suspense, useEffect, useState } from "react";
import { AppShell } from "@/components/AppLayout";
import { AppLoadingSkeleton, RouteSkeleton } from "@/components/routeSkeletons";
import { RouteLoadBoundary } from "@/components/RouteLoadBoundary";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { ArcThemeSync } from "@/components/arc/ArcThemeSync";
import { POINTS_FEATURE_ENABLED } from "@/lib/featureFlags";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Bot } from "lucide-react";
import { DemoBanner } from "@/components/DemoBanner";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { LangProvider } from "@/contexts/LanguageContext";
import { DemoModeProvider, useDemoMode } from "@/contexts/DemoModeContext";
import { useSettings } from "@/hooks/useData";
import AuthPage from "./pages/Auth";
import ResetPasswordPage from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";
const OAuthConsentPage = lazy(() => import("./pages/OAuthConsent"));

const AIChatPanel = lazy(() => import("@/components/AIChatPanel").then(m => ({ default: m.AIChatPanel })));

// Lazy-loaded pages — each becomes its own chunk, loaded on demand
const Index = lazy(() => import("./pages/Index"));
const PantryPage = lazy(() => import("./pages/Pantry"));
const BelongingsPage = lazy(() => import("./pages/Belongings"));
const SchedulePage = lazy(() => import("./pages/Schedule"));
const CaloriesPage = lazy(() => import("./pages/Calories"));
const FinancePage = lazy(() => import("./pages/Finance"));
const TodosPage = lazy(() => import("./pages/Todos"));
const TodayTodoPage = lazy(() => import("./pages/TodayTodo"));
const ThoughtsPage = lazy(() => import("./pages/Thoughts"));
const LearningNotesPage = lazy(() => import("./pages/LearningNotes"));
const GoalsPage = lazy(() => import("./pages/Goals"));
const WeightLossPage = lazy(() => import("./pages/WeightLoss"));
const CivilServiceHome = lazy(() => import("./pages/civil-service/CivilServiceHome"));
const CivilServiceGroup = lazy(() => import("./pages/civil-service/CivilServiceGroup"));
const ProjectsPage = lazy(() => import("./pages/Projects"));
const ShopPage = lazy(() => import("./pages/Shop"));
const NewspapersPage = lazy(() => import("./pages/Newspapers"));
const SettingsPage = lazy(() => import("./pages/Settings"));
const FortuneHome = lazy(() => import("./pages/fortune/FortuneHome"));
const TarotPage = lazy(() => import("./pages/fortune/TarotPage"));
const ZodiacPage = lazy(() => import("./pages/fortune/ZodiacPage"));
const ShengxiaoPage = lazy(() => import("./pages/fortune/ShengxiaoPage"));
const IchingPage = lazy(() => import("./pages/fortune/IchingPage"));
const LotPage = lazy(() => import("./pages/fortune/LotPage"));
const BaziPage = lazy(() => import("./pages/fortune/BaziPage"));
const FortuneHistoryPage = lazy(() => import("./pages/fortune/HistoryPage"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 3 * 60 * 1000 },
  },
});

function ProtectedRoute() {
  const { user, loading } = useAuth();
  const { isDemo } = useDemoMode();
  if (!user && !isDemo && !loading) return <Navigate to="/auth" replace />;
  return <AppShell pending={loading && !isDemo} />;
}

function FocusHomeRedirect({ children }: { children: React.ReactNode }) {
  const { data: settings } = useSettings();
  const focusMode = (settings as { app_focus_mode?: string } | null)?.app_focus_mode || "full";
  if (focusMode === "civil_service") {
    return <Navigate to="/civil-service" replace />;
  }
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <>
      <DemoBanner />
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/oauth/consent" element={<RouteLoadBoundary><Suspense fallback={<RouteSkeleton pathname="/oauth/consent" />}><OAuthConsentPage /></Suspense></RouteLoadBoundary>} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/" element={<FocusHomeRedirect><Index /></FocusHomeRedirect>} />
          <Route path="/pantry" element={<PantryPage />} />
          <Route path="/belongings" element={<BelongingsPage />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/calories" element={<CaloriesPage />} />
          <Route path="/finance" element={<FinancePage />} />
          <Route path="/todos" element={<TodosPage />} />
          <Route path="/today" element={<TodayTodoPage />} />
          <Route path="/projects" element={<ProjectsPage />} />
          <Route path="/goals" element={<GoalsPage />} />
          <Route path="/thoughts" element={<ThoughtsPage />} />
          <Route path="/learning-notes" element={<LearningNotesPage />} />
          <Route path="/weight-loss" element={<WeightLossPage />} />
          <Route path="/civil-service" element={<CivilServiceHome />} />
          <Route path="/civil-service/:group" element={<CivilServiceGroup />} />
          {POINTS_FEATURE_ENABLED && <Route path="/shop" element={<ShopPage />} />}
          <Route path="/fortune" element={<FortuneHome />} />
          <Route path="/fortune/tarot" element={<TarotPage />} />
          <Route path="/fortune/zodiac" element={<ZodiacPage />} />
          <Route path="/fortune/shengxiao" element={<ShengxiaoPage />} />
          <Route path="/fortune/iching" element={<IchingPage />} />
          <Route path="/fortune/lot" element={<LotPage />} />
          <Route path="/fortune/bazi" element={<BaziPage />} />
          <Route path="/fortune/history" element={<FortuneHistoryPage />} />
          <Route path="/newspapers" element={<NewspapersPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

function DeferredAIChatPanel() {
  const [shouldLoad, setShouldLoad] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    const open = () => setShouldLoad(true);
    window.addEventListener("open-ai-chat", open);
    return () => window.removeEventListener("open-ai-chat", open);
  }, []);

  if (shouldLoad) {
    return (
      <Suspense fallback={null}>
        <AIChatPanel initialOpen showLauncher={pathname !== "/" && pathname !== "/newspapers"} />
      </Suspense>
    );
  }

  // Home has AI capture; the paper reader has its own AI review action.
  // Keep the floating launcher from covering agenda and archive content.
  if (pathname === "/" || pathname === "/newspapers") return null;

  return (
    <Button
      type="button"
      onClick={() => setShouldLoad(true)}
      size="icon"
      aria-label="打开 AI 助手 / Open AI Assistant"
      className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50 h-12 w-12 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg"
    >
      <Bot className="h-6 w-6" />
    </Button>
  );
}

function SessionLoading() {
  const { pathname } = useLocation();
  return <AppLoadingSkeleton pathname={pathname} />;
}

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
    <ArcThemeSync />
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <LangProvider>
            <DemoModeProvider>
              <AuthProvider fallback={<SessionLoading />}>
                <AppRoutes />
                <DeferredAIChatPanel />
              </AuthProvider>
            </DemoModeProvider>
          </LangProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
