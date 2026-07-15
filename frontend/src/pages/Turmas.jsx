import React from "react";
import useSWR from "swr";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { BookOpen, Users, ExternalLink } from "lucide-react";

const fetcher = (url) => api.get(url).then((r) => r.data);

export default function Turmas() {
  const { data, error, isLoading } = useSWR("/classroom/courses", fetcher);

  if (isLoading) return <div className="text-muted-foreground">Carregando turmas...</div>;
  if (error?.response?.status === 428) {
    return (
      <Card className="p-8 text-center border-dashed">
        <p className="mb-4 text-muted-foreground">Você precisa conectar o Google Classroom primeiro.</p>
        <Link to="/configuracoes"><Button>Conectar Classroom</Button></Link>
      </Card>
    );
  }
  if (error) return <div className="text-destructive">Erro ao carregar.</div>;

  const courses = data?.courses || [];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Turmas</h1>
        <p className="text-muted-foreground mt-1">Turmas ativas sincronizadas do Google Classroom.</p>
      </div>

      {courses.length === 0 ? (
        <Card className="p-10 text-center border-dashed">
          <p className="text-muted-foreground">Nenhuma turma encontrada.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" data-testid="turmas-grid">
          {courses.map((c) => (
            <Link key={c.id} to={`/turmas/${c.id}`}>
              <Card className="p-6 border border-border hover:border-primary/40 hover:shadow-md transition-all cursor-pointer h-full">
                <div className="flex items-start justify-between mb-4">
                  <div className="h-10 w-10 rounded-lg bg-blue-50 text-primary flex items-center justify-center">
                    <BookOpen className="h-5 w-5" />
                  </div>
                  <span className={`text-[10px] uppercase tracking-wider font-semibold px-2 py-1 rounded-md ${
                    c.courseState === "ACTIVE" ? "bg-emerald-50 text-emerald-700" : "bg-muted text-muted-foreground"
                  }`}>
                    {c.courseState || "—"}
                  </span>
                </div>
                <h3 className="font-display font-semibold text-lg mb-1 line-clamp-2">{c.name}</h3>
                <p className="text-xs text-muted-foreground mb-4 line-clamp-1">
                  {c.section || c.descriptionHeading || "Sem seção"}
                </p>
                <div className="flex items-center justify-between pt-4 border-t border-border">
                  <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" /> Ver alunos
                  </span>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
