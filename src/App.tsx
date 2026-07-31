import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AIChatPanel } from "@/components/AIChatPanel";
import { DemoBanner } from "@/components/DemoBanner";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { LangProvider } from "@/contexts/LanguageContext";
import { DemoModeProvider, useDemoMode } from "@/contexts/DemoModeContext";
import AuthPage from "./pages/Auth";
import ResetPasswordPage from "./pages/ResetPassword";
import NotFound from "./pages/NotFound";

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
const ProjectsPage = lazy(() => import("./pages/Projects"));
const ShopPage = lazy(() => import("./pages/Shop"));
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

function PageLoader() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f4f3ee]">
      <div className="flex flex-col items-center gap-3">
        <div className="h-6 w-6 border-2 border-[#d17847] border-t-transparent rounded-full animate-spin" />
        <p className="text-[13px] text-[#8a847a] font-medium">Loading...</p>
      </div>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { isDemo } = useDemoMode();
  if (loading && !isDemo) return <PageLoader />;
  if (!user && !isDemo) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <>
      <DemoBanner />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route path="/auth" element={<AuthPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
          <Route path="/pantry" element={<ProtectedRoute><PantryPage /></ProtectedRoute>} />
          <Route path="/belongings" element={<ProtectedRoute><BelongingsPage /></ProtectedRoute>} />
          <Route path="/schedule" element={<ProtectedRoute><SchedulePage /></ProtectedRoute>} />
          <Route path="/calories" element={<ProtectedRoute><CaloriesPage /></ProtectedRoute>} />
          <Route path="/finance" element={<ProtectedRoute><FinancePage /></ProtectedRoute>} />
          <Route path="/todos" element={<ProtectedRoute><TodosPage /></ProtectedRoute>} />
          <Route path="/today" element={<ProtectedRoute><TodayTodoPage /></ProtectedRoute>} />
          <Route path="/projects" element={<ProtectedRoute><ProjectsPage /></ProtectedRoute>} />
          <Route path="/goals" element={<ProtectedRoute><GoalsPage /></ProtectedRoute>} />
          <Route path="/thoughts" element={<ProtectedRoute><ThoughtsPage /></ProtectedRoute>} />
          <Route path="/learning-notes" element={<ProtectedRoute><LearningNotesPage /></ProtectedRoute>} />
          <Route path="/weight-loss" element={<ProtectedRoute><WeightLossPage /></ProtectedRoute>} />
          <Route path="/shop" element={<ProtectedRoute><ShopPage /></ProtectedRoute>} />
          <Route path="/fortune" element={<ProtectedRoute><FortuneHome /></ProtectedRoute>} />
          <Route path="/fortune/tarot" element={<ProtectedRoute><TarotPage /></ProtectedRoute>} />
          <Route path="/fortune/zodiac" element={<ProtectedRoute><ZodiacPage /></ProtectedRoute>} />
          <Route path="/fortune/shengxiao" element={<ProtectedRoute><ShengxiaoPage /></ProtectedRoute>} />
          <Route path="/fortune/iching" element={<ProtectedRoute><IchingPage /></ProtectedRoute>} />
          <Route path="/fortune/lot" element={<ProtectedRoute><LotPage /></ProtectedRoute>} />
          <Route path="/fortune/bazi" element={<ProtectedRoute><BaziPage /></ProtectedRoute>} />
          <Route path="/fortune/history" element={<ProtectedRoute><FortuneHistoryPage /></ProtectedRoute>} />
          <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <LangProvider>
          <DemoModeProvider>
            <AuthProvider>
              <AppRoutes />
              <AIChatPanel />
            </AuthProvider>
          </DemoModeProvider>
        </LangProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
