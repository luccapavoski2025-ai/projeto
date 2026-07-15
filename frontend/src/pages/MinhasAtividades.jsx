import React from "react";
import useSWR from "swr";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Link } from "react-router-dom";
import { ClipboardList, Clock, Calendar, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const fetcher = (url) => api.get(url).then((r) => r.data);

export default function MinhasAtividades() {
  const { data, isLoading } = useSWR("/student/coursework", fetcher);

  if (isLoading) return <div className="text-muted-foreground">Carregando atividades...</div>;

  const list = data?.coursework || [];
  const grouped = list.reduce((acc, cw) => {
    (acc[cw.course_name] = acc[cw.course_name] || []).push(cw);
    return acc;
  }, {});

  return (
    <div className="space-y-8" data-testid="student-coursework-page">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Minhas Atividades</h1>
        <p className="text-muted-foreground mt-1">Todas as atividades publicadas pelo(s) seu(s) professor(es).</p>
      </div>

      {list.length === 0 ? (
        <Card className="p-10 text-center border-dashed">
          <ClipboardList className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
          <p className="text-muted-foreground">Nenhuma atividade publicada ainda.</p>
        </Card>
      ) : (
        Object.entries(grouped).map(([course, items]) => (
          <div key={course}>
            <h2 className="font-display font-semibold text-lg mb-3">{course}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {items.map((cw) => (
                <Link key={cw.id} to={`/minhas-atividades/${cw.course_id}/${cw.id}`}>
                  <Card className="p-5 border border-border hover:border-primary/40 hover:shadow-md transition-all h-full">
                    <div className="flex items-start justify-between mb-3">
                      <div className="h-9 w-9 rounded-lg bg-blue-50 text-primary flex items-center justify-center">
                        <ClipboardList className="h-4 w-4" />
                      </div>
                      {cw.max_points && (
                        <span className="text-xs text-muted-foreground">
                          {cw.max_points} pts
                        </span>
                      )}
                    </div>
                    <h3 className="font-display font-semibold mb-2 line-clamp-2">{cw.title}</h3>
                    {cw.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{cw.description}</p>
                    )}
                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t border-border">
                      {cw.due_date ? (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {cw.due_date.day}/{cw.due_date.month}/{cw.due_date.year}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" /> Sem prazo</span>
                      )}
                      <ArrowRight className="h-3 w-3 text-primary" />
                    </div>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
