import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AIChatPanel } from "@/components/AIChatPanel";
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
import SettingsPage from "./pages/Settings";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/pantry" element={<PantryPage />} />
          <Route path="/belongings" element={<BelongingsPage />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/calories" element={<CaloriesPage />} />
          <Route path="/finance" element={<FinancePage />} />
          <Route path="/todos" element={<TodosPage />} />
          <Route path="/thoughts" element={<ThoughtsPage />} />
          <Route path="/weight-loss" element={<WeightLossPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
        <AIChatPanel />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
