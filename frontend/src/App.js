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

function AppRouter() {
  const location = useLocation();
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }
  return (
    <Routes>
      <Route path="/" element={<Login />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <AppLayout><Dashboard /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/turmas"
        element={
          <ProtectedRoute>
            <AppLayout><Turmas /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/turmas/:id"
        element={
          <ProtectedRoute>
            <AppLayout><TurmaDetalhe /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/alunos"
        element={
          <ProtectedRoute>
            <AppLayout><Alunos /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/alunos/:id"
        element={
          <ProtectedRoute>
            <AppLayout><AlunoPerfil /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/configuracoes"
        element={
          <ProtectedRoute>
            <AppLayout><Configuracoes /></AppLayout>
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
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
