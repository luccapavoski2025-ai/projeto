import React, { useMemo, useState } from "react";
import useSWR from "swr";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { Search, AlertTriangle, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

const fetcher = (url) => api.get(url).then((r) => r.data);

const riskStyle = {
  Baixo: "bg-emerald-50 text-emerald-700 border-emerald-100",
  Moderado: "bg-amber-50 text-amber-700 border-amber-100",
  Alto: "bg-rose-50 text-rose-700 border-rose-100",
};

export default function Alunos() {
  const { data, isLoading, error } = useSWR("/students", fetcher);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");

  const students = data?.students || [];

  const filtered = useMemo(() => {
    return students.filter((s) => {
      const matchQ = (s.name + s.email).toLowerCase().includes(q.toLowerCase());
      const matchF = filter === "all" || s.risk === filter;
      return matchQ && matchF;
    });
  }, [students, q, filter]);

  if (isLoading) return <div className="text-muted-foreground">Carregando alunos...</div>;
  if (error?.response?.status === 428) {
    return (
      <Card className="p-8 text-center border-dashed">
        <p className="mb-4 text-muted-foreground">Conecte o Google Classroom primeiro.</p>
        <Link to="/configuracoes"><Button>Conectar</Button></Link>
      </Card>
    );
  }
  if (error) return <div className="text-destructive">Erro ao carregar.</div>;

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Alunos</h1>
          <p className="text-muted-foreground mt-1">{students.length} alunos com análise de IA.</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            data-testid="alunos-search"
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Pesquisar por nome ou email"
            className="w-full h-10 pl-9 pr-3 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
          />
        </div>
        <div className="flex items-center gap-1 bg-muted p-1 rounded-lg">
          {[
            { v: "all", label: "Todos" },
            { v: "Alto", label: "Risco alto" },
            { v: "Moderado", label: "Moderado" },
            { v: "Baixo", label: "Baixo" },
          ].map((o) => (
            <button
              key={o.v}
              onClick={() => setFilter(o.v)}
              data-testid={`filter-${o.v}`}
              className={cn(
                "px-3 h-8 text-xs font-medium rounded-md transition-colors",
                filter === o.v ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <Card className="border border-border overflow-hidden" data-testid="alunos-table">
        <div className="grid grid-cols-12 px-6 py-3 border-b border-border bg-muted/40 text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
          <div className="col-span-5">Aluno</div>
          <div className="col-span-3">Turmas</div>
          <div className="col-span-2">Risco IA</div>
          <div className="col-span-2 text-right">Score</div>
        </div>
        <div className="divide-y divide-border">
          {filtered.map((s) => (
            <Link
              key={s.id}
              to={`/alunos/${s.id}`}
              className="grid grid-cols-12 px-6 py-3.5 items-center hover:bg-muted/40 transition-colors"
            >
              <div className="col-span-5 flex items-center gap-3 min-w-0">
                <div className="h-9 w-9 rounded-full bg-blue-50 text-primary text-xs font-semibold flex items-center justify-center flex-shrink-0">
                  {s.name.split(" ").slice(0, 2).map((n) => n[0]).join("")}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{s.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{s.email}</p>
                </div>
              </div>
              <div className="col-span-3 text-xs text-muted-foreground truncate">
                {(s.courses || []).map((c) => c.name).join(", ")}
              </div>
              <div className="col-span-2">
                <span className={cn("inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full border", riskStyle[s.risk])}>
                  {s.risk === "Alto" ? <AlertTriangle className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                  {s.risk}
                </span>
              </div>
              <div className="col-span-2 text-right">
                <span className="font-display font-bold tabular-nums">{s.ai_score}</span>
              </div>
            </Link>
          ))}
          {filtered.length === 0 && (
            <div className="p-10 text-center text-sm text-muted-foreground">Nenhum aluno encontrado.</div>
          )}
        </div>
      </Card>
    </div>
  );
}
