import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { ThemeProvider } from "next-themes";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Agenda from "./pages/Agenda";
import Pacientes from "./pages/Pacientes";
import Profissionais from "./pages/Profissionais";
import Financeiro from "./pages/Financeiro";
import Relatorios from "./pages/Relatorios";
import Configuracoes from "./pages/Configuracoes";
import Logs from "./pages/Logs";
import Assistente from "./pages/Assistente";
import Aprovacoes from "./pages/Aprovacoes";
import ContasPagar from "./pages/ContasPagar";
import CRM from "./pages/CRM";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Index />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/agenda"
                element={
                  <ProtectedRoute>
                    <Agenda />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/pacientes"
                element={
                  <ProtectedRoute>
                    <Pacientes />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profissionais"
                element={
                  <ProtectedRoute>
                    <Profissionais />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/financeiro"
                element={
                  <ProtectedRoute>
                    <Financeiro />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/relatorios"
                element={
                  <ProtectedRoute>
                    <Relatorios />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/configuracoes"
                element={
                  <ProtectedRoute>
                    <Configuracoes />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/logs"
                element={
                  <ProtectedRoute>
                    <Logs />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/assistente"
                element={
                  <ProtectedRoute>
                    <Assistente />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/aprovacoes"
                element={
                  <ProtectedRoute>
                    <Aprovacoes />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/contas-pagar"
                element={
                  <ProtectedRoute>
                    <ContasPagar />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/crm"
                element={
                  <ProtectedRoute>
                    <CRM />
                  </ProtectedRoute>
                }
              />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
