import React from "react";
import { NavLink } from "react-router-dom";
import { LayoutDashboard, Users, BookOpen, Settings, GraduationCap, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { to: "/dashboard", label: "Visão Geral", icon: LayoutDashboard, testId: "nav-dashboard" },
  { to: "/turmas", label: "Turmas", icon: BookOpen, testId: "nav-turmas" },
  { to: "/alunos", label: "Alunos", icon: Users, testId: "nav-alunos" },
  { to: "/configuracoes", label: "Configurações", icon: Settings, testId: "nav-configuracoes" },
];

export default function Sidebar() {
  return (
    <aside className="hidden lg:flex fixed inset-y-0 left-0 w-[260px] flex-col border-r border-border bg-white z-30">
      <div className="h-16 flex items-center gap-3 px-6 border-b border-border">
        <div className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
          <GraduationCap className="h-5 w-5" />
        </div>
        <div>
          <p className="font-display font-bold text-lg leading-none">EduCRM</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">Painel do Professor</p>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        <p className="px-3 pb-2 pt-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Principal
        </p>
        {items.map(({ to, label, icon: Icon, testId }) => (
          <NavLink
            key={to}
            to={to}
            data-testid={testId}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="p-4">
        <div className="rounded-xl border border-border bg-gradient-to-br from-blue-50 to-white p-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold text-primary">Insights IA</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            A IA analisou o desempenho dos seus alunos hoje. Confira as recomendações no dashboard.
          </p>
        </div>
      </div>
    </aside>
  );
}
