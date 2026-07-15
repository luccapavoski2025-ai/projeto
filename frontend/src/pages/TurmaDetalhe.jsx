import React from "react";
import { useParams, Link } from "react-router-dom";
import useSWR from "swr";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Users, ClipboardList, Calendar, Plus } from "lucide-react";

const fetcher = (url) => api.get(url).then((r) => r.data);

export default function TurmaDetalhe() {
  const { id } = useParams();
  const { data, isLoading, error } = useSWR(`/classroom/courses/${id}`, fetcher);

  if (isLoading) return <div className="text-muted-foreground">Carregando turma...</div>;
  if (error) return <div className="text-destructive">Erro ao carregar.</div>;

  const { course, students = [], coursework = [] } = data;

  return (
    <div className="space-y-8">
      <Link to="/turmas" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-2">
        <ArrowLeft className="h-4 w-4" /> Voltar para turmas
      </Link>

      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">{course.name}</h1>
          <p className="text-muted-foreground mt-1">{course.section || course.descriptionHeading}</p>
        </div>
        <Link to={`/turmas/${id}/nova-tarefa`}>
          <Button data-testid="new-task-button" size="lg">
            <Plus className="h-4 w-4 mr-1" />
            Nova Tarefa
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-5 border border-border">
          <Users className="h-5 w-5 text-primary mb-3" />
          <p className="text-3xl font-display font-bold">{students.length}</p>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Alunos</p>
        </Card>
        <Card className="p-5 border border-border">
          <ClipboardList className="h-5 w-5 text-primary mb-3" />
          <p className="text-3xl font-display font-bold">{coursework.length}</p>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Atividades</p>
        </Card>
        <Card className="p-5 border border-border">
          <Calendar className="h-5 w-5 text-primary mb-3" />
          <p className="text-sm font-semibold">{course.creationTime?.slice(0, 10) || "—"}</p>
          <p className="text-xs text-muted-foreground uppercase tracking-wider mt-1">Criada em</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-6 border border-border">
          <h2 className="font-display font-semibold text-lg mb-4">Alunos</h2>
          <div className="space-y-1 max-h-[440px] overflow-y-auto">
            {students.map((s) => {
              const p = s.profile || {};
              const sid = p.id || s.userId;
              return (
                <Link
                  key={sid}
                  to={`/alunos/${sid}`}
                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted transition-colors"
                >
                  {p.photoUrl ? (
                    <img src={`https:${p.photoUrl.startsWith("//") ? p.photoUrl : ""}${p.photoUrl.startsWith("//") ? "" : p.photoUrl}`}
                         alt="" className="h-8 w-8 rounded-full object-cover" />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-blue-50 text-primary text-xs font-semibold flex items-center justify-center">
                      {(p.name?.fullName || "?").split(" ").slice(0, 2).map((x) => x[0]).join("")}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{p.name?.fullName || "Aluno"}</p>
                    <p className="text-xs text-muted-foreground truncate">{p.emailAddress}</p>
                  </div>
                </Link>
              );
            })}
            {students.length === 0 && <p className="text-sm text-muted-foreground">Sem alunos.</p>}
          </div>
        </Card>

        <Card className="p-6 border border-border">
          <h2 className="font-display font-semibold text-lg mb-4">Atividades</h2>
          <div className="space-y-2 max-h-[440px] overflow-y-auto">
            {coursework.map((cw) => (
              <Link
                key={cw.id}
                to={`/turmas/${id}/atividades/${cw.id}`}
                className="block p-3 rounded-lg border border-border hover:border-primary/40 hover:bg-muted/40 transition-colors"
              >
                <p className="text-sm font-medium">{cw.title}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {cw.workType} • {cw.state}
                </p>
              </Link>
            ))}
            {coursework.length === 0 && <p className="text-sm text-muted-foreground">Sem atividades.</p>}
          </div>
        </Card>
      </div>
    </div>
  );
}
