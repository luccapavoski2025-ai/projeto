import React from "react";
import { useParams, Link } from "react-router-dom";
import useSWR from "swr";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Calendar, Award, CheckCircle2, Clock } from "lucide-react";

const fetcher = (url) => api.get(url).then((r) => r.data);

export default function AtividadeAluno() {
  const { courseId, cwId } = useParams();
  const { data, isLoading } = useSWR(`/student/courses/${courseId}/coursework/${cwId}`, fetcher);

  if (isLoading) return <div className="text-muted-foreground">Carregando...</div>;
  const cw = data?.coursework;
  const my = data?.my_submission;

  return (
    <div className="space-y-8 max-w-3xl">
      <Link to="/minhas-atividades" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-2">
        <ArrowLeft className="h-4 w-4" /> Voltar
      </Link>

      <Card className="p-6 border border-border">
        <h1 className="font-display text-2xl font-bold tracking-tight">{cw?.title}</h1>
        {cw?.description && <p className="text-muted-foreground mt-3 whitespace-pre-wrap">{cw.description}</p>}
        <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-border">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Pontos</p>
            <p className="font-display font-bold text-lg">{cw?.maxPoints || "—"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Prazo</p>
            <p className="font-display font-bold text-lg">
              {cw?.dueDate ? `${cw.dueDate.day}/${cw.dueDate.month}` : "Livre"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Estado</p>
            <p className="font-display font-bold text-lg">{my?.state || "Nova"}</p>
          </div>
        </div>
      </Card>

      <Card className="p-6 border border-border">
        <h2 className="font-display font-semibold text-lg mb-4">Sua entrega</h2>
        {!my && (
          <p className="text-sm text-muted-foreground">Nenhuma entrega registrada ainda.</p>
        )}
        {my && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 rounded-lg bg-blue-50/50 border border-blue-100">
              <CheckCircle2 className="h-5 w-5 text-primary" />
              <div className="text-sm">
                <p className="font-medium">Estado: {my.state}</p>
                {my.assignedGrade != null && (
                  <p className="text-primary font-bold mt-1">
                    Nota: {my.assignedGrade} / {cw?.maxPoints}
                  </p>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Para entregar ou editar sua tarefa, acesse o Google Classroom. Este painel é somente leitura para alunos.
            </p>
            {my.alternateLink && (
              <a
                href={my.alternateLink}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-primary font-medium hover:underline"
              >
                Abrir no Google Classroom →
              </a>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
