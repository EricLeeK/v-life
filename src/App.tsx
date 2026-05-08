import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AIChatPanel } from "@/components/AIChatPanel";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { LangProvider } from "@/contexts/LanguageContext";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import PantryPage from "./pages/Pantry";
import BelongingsPage from "./pages/Belongings";
import SchedulePage from "./pages/Schedule";
import CaloriesPage from "./pages/Calories";
import FinancePage from "./pages/Finance";
import TodosPage from "./pages/Todos";
import ThoughtsPage from "./pages/Thoughts";
import GoalsPage from "./pages/Goals";
import WeightLossPage from "./pages/WeightLoss";
import ProjectsPage from "./pages/Projects";
import SettingsPage from "./pages/Settings";
import AuthPage from "./pages/Auth";
import ResetPasswordPage from "./pages/ResetPassword";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Loading...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
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
      <Route path="/projects" element={<ProtectedRoute><ProjectsPage /></ProtectedRoute>} />
      <Route path="/goals" element={<ProtectedRoute><GoalsPage /></ProtectedRoute>} />
      <Route path="/thoughts" element={<ProtectedRoute><ThoughtsPage /></ProtectedRoute>} />
      <Route path="/weight-loss" element={<ProtectedRoute><WeightLossPage /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <LangProvider>
          <AuthProvider>
            <AppRoutes />
            <AIChatPanel />
          </AuthProvider>
        </LangProvider>
      </BrowserRouter>
      <Analytics />
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
