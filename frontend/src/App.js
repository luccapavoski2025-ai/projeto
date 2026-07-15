import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/auth";
import { Toaster } from "sonner";

import Login from "@/pages/Login";
import AuthCallback from "@/pages/AuthCallback";
import Dashboard from "@/pages/Dashboard";
import Turmas from "@/pages/Turmas";
import TurmaDetalhe from "@/pages/TurmaDetalhe";
import Alunos from "@/pages/Alunos";
import AlunoPerfil from "@/pages/AlunoPerfil";
import Configuracoes from "@/pages/Configuracoes";
import NovaTarefa from "@/pages/NovaTarefa";
import AtividadeDetalhe from "@/pages/AtividadeDetalhe";
import CorrecaoEntrega from "@/pages/CorrecaoEntrega";
import MinhasAtividades from "@/pages/MinhasAtividades";
import AtividadeAluno from "@/pages/AtividadeAluno";
import AppLayout from "@/components/AppLayout";

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Carregando...
      </div>
    );
  }
  if (!user) return <Navigate to="/" replace />;
  return children;
}

function RoleHome() {
  const { user } = useAuth();
  if (user?.role === "student") return <Navigate to="/minhas-atividades" replace />;
  return <Navigate to="/dashboard" replace />;
}

function RequireRole({ role, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/" replace />;
  if (user.role !== role) return <Navigate to="/" replace />;
  return children;
}

function AppRouter() {
  const location = useLocation();
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route path="/home" element={<ProtectedRoute><RoleHome /></ProtectedRoute>} />
      <Route path="/configuracoes" element={<ProtectedRoute><AppLayout><Configuracoes /></AppLayout></ProtectedRoute>} />

      {/* Teacher-only routes */}
      <Route path="/dashboard" element={<ProtectedRoute><RequireRole role="teacher"><AppLayout><Dashboard /></AppLayout></RequireRole></ProtectedRoute>} />
      <Route path="/turmas" element={<ProtectedRoute><RequireRole role="teacher"><AppLayout><Turmas /></AppLayout></RequireRole></ProtectedRoute>} />
      <Route path="/turmas/:id" element={<ProtectedRoute><RequireRole role="teacher"><AppLayout><TurmaDetalhe /></AppLayout></RequireRole></ProtectedRoute>} />
      <Route path="/turmas/:id/nova-tarefa" element={<ProtectedRoute><RequireRole role="teacher"><AppLayout><NovaTarefa /></AppLayout></RequireRole></ProtectedRoute>} />
      <Route path="/turmas/:id/atividades/:cwId" element={<ProtectedRoute><RequireRole role="teacher"><AppLayout><AtividadeDetalhe /></AppLayout></RequireRole></ProtectedRoute>} />
      <Route path="/entregas/:courseId/:cwId/:subId" element={<ProtectedRoute><RequireRole role="teacher"><AppLayout><CorrecaoEntrega /></AppLayout></RequireRole></ProtectedRoute>} />
      <Route path="/alunos" element={<ProtectedRoute><RequireRole role="teacher"><AppLayout><Alunos /></AppLayout></RequireRole></ProtectedRoute>} />
      <Route path="/alunos/:id" element={<ProtectedRoute><RequireRole role="teacher"><AppLayout><AlunoPerfil /></AppLayout></RequireRole></ProtectedRoute>} />

      {/* Student-only routes */}
      <Route path="/minhas-atividades" element={<ProtectedRoute><RequireRole role="student"><AppLayout><MinhasAtividades /></AppLayout></RequireRole></ProtectedRoute>} />
      <Route path="/minhas-atividades/:courseId/:cwId" element={<ProtectedRoute><RequireRole role="student"><AppLayout><AtividadeAluno /></AppLayout></RequireRole></ProtectedRoute>} />

      <Route path="*" element={<Navigate to="/home" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <AppRouter />
          <Toaster position="top-right" richColors />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
