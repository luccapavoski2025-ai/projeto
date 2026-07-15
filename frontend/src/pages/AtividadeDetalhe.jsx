import React from "react";
import { useParams, Link } from "react-router-dom";
import useSWR from "swr";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { ArrowLeft, ClipboardCheck, Clock, CheckCircle2, Circle, Award } from "lucide-react";
import { cn } from "@/lib/utils";

const fetcher = (url) => api.get(url).then((r) => r.data);

const stateStyle = {
  TURNED_IN: { icon: ClipboardCheck, cls: "text-emerald-700 bg-emerald-50", label: "Entregue" },
  RETURNED: { icon: Award, cls: "text-blue-700 bg-blue-50", label: "Corrigido" },
  CREATED: { icon: Circle, cls: "text-muted-foreground bg-muted", label: "Não iniciado" },
  NEW: { icon: Circle, cls: "text-muted-foreground bg-muted", label: "Não iniciado" },
  RECLAIMED_BY_STUDENT: { icon: Clock, cls: "text-amber-700 bg-amber-50", label: "Retomado" },
};

export default function AtividadeDetalhe() {
  const { id: courseId, cwId } = useParams();
  const { data: cw } = useSWR(`/classroom/courses/${courseId}/coursework/${cwId}`, fetcher);
  const { data: subsRes, isLoading } = useSWR(`/classroom/courses/${courseId}/coursework/${cwId}/submissions`, fetcher);

  const subs = subsRes?.submissions || [];
  const submitted = subs.filter((s) => s.state === "TURNED_IN" || s.state === "RETURNED").length;

  return (
    <div className="space-y-8">
      <Link to={`/turmas/${courseId}`} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-2">
        <ArrowLeft className="h-4 w-4" /> Voltar para turma
      </Link>

      <div>
        <p className="text-xs text-primary font-semibold uppercase tracking-wider mb-1">Atividade</p>
        <h1 className="font-display text-3xl font-bold tracking-tight">{cw?.title || "..."}</h1>
        {cw?.description && <p className="text-muted-foreground mt-2 whitespace-pre-wrap max-w-3xl">{cw.description}</p>}
        <div className="flex gap-6 mt-4 text-sm text-muted-foreground">
          {cw?.maxPoints && <span>Máx: <strong className="text-foreground">{cw.maxPoints} pts</strong></span>}
          {cw?.dueDate && <span>Prazo: <strong className="text-foreground">{cw.dueDate.day}/{cw.dueDate.month}/{cw.dueDate.year}</strong></span>}
          <span>Entregues: <strong className="text-foreground">{submitted}/{subs.length}</strong></span>
        </div>
      </div>

      <Card className="border border-border overflow-hidden" data-testid="submissions-list">
        <div className="px-6 py-4 border-b border-border">
          <h2 className="font-display font-semibold text-lg">Entregas dos alunos</h2>
        </div>
        {isLoading && <div className="p-8 text-sm text-muted-foreground">Carregando...</div>}
        <div className="divide-y divide-border">
          {subs.map((s) => {
            const style = stateStyle[s.state] || stateStyle.CREATED;
            const S = style.icon;
            const canGrade = s.state === "TURNED_IN" || s.state === "RETURNED";
            return (
              <Link
                key={s.id}
                to={`/entregas/${courseId}/${cwId}/${s.id}`}
                className={cn(
                  "grid grid-cols-12 items-center px-6 py-4 transition-colors",
                  canGrade ? "hover:bg-muted/40" : "opacity-70"
                )}
              >
                <div className="col-span-5 flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-full bg-blue-50 text-primary text-xs font-semibold flex items-center justify-center flex-shrink-0">
                    {(s._student?.name || "?").split(" ").slice(0, 2).map((n) => n[0]).join("")}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{s._student?.name || "Aluno"}</p>
                    <p className="text-xs text-muted-foreground truncate">{s._student?.email}</p>
                  </div>
                </div>
                <div className="col-span-4">
                  <span className={cn("inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full", style.cls)}>
                    <S className="h-3 w-3" />
                    {style.label}
                  </span>
                </div>
                <div className="col-span-2 text-sm">
                  {s.assignedGrade != null ? (
                    <span className="font-display font-bold">{s.assignedGrade}<span className="text-muted-foreground text-xs">/{cw?.maxPoints}</span></span>
                  ) : (
                    <span className="text-xs text-muted-foreground">—</span>
                  )}
                </div>
                <div className="col-span-1 text-right text-xs text-primary font-semibold">
                  {canGrade ? "Corrigir →" : ""}
                </div>
              </Link>
            );
          })}
          {!isLoading && subs.length === 0 && (
            <div className="p-10 text-center text-sm text-muted-foreground">Sem entregas ainda.</div>
          )}
        </div>
      </Card>
    </div>
  );
}
