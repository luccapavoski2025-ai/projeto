import React from "react";
import useSWR from "swr";
import { api } from "@/lib/api";
import KpiCard from "@/components/KpiCard";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, BookOpen, ClipboardList, TrendingUp, Sparkles, AlertTriangle, Info, CheckCircle2, ExternalLink } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend,
} from "recharts";
import { Link } from "react-router-dom";

const fetcher = (url) => api.get(url).then((r) => r.data);

function InsightItem({ ins }) {
  const map = {
    positive: { Icon: CheckCircle2, cls: "text-emerald-700 bg-emerald-50" },
    warning: { Icon: AlertTriangle, cls: "text-amber-700 bg-amber-50" },
    info: { Icon: Info, cls: "text-blue-700 bg-blue-50" },
  };
  const { Icon, cls } = map[ins.type] || map.info;
  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-border">
      <div className={`h-8 w-8 rounded-md flex items-center justify-center flex-shrink-0 ${cls}`}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-sm leading-relaxed">{ins.text}</p>
    </div>
  );
}

export default function Dashboard() {
  const { data, error, isLoading } = useSWR("/dashboard/metrics", fetcher);

  if (isLoading) return <div className="text-muted-foreground">Carregando dashboard...</div>;
  if (error) return <div className="text-destructive">Erro ao carregar dados.</div>;

  if (!data?.classroom_connected) {
    return (
      <div className="max-w-2xl">
        <Card className="p-10 text-center border border-dashed">
          <div className="mx-auto h-14 w-14 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
            <BookOpen className="h-7 w-7 text-primary" />
          </div>
          <h2 className="font-display text-2xl font-bold mb-2">Conecte seu Google Classroom</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Para ver métricas, turmas e alunos aqui, autorize o EduCRM a acessar suas turmas do Google Classroom.
          </p>
          <Link to="/configuracoes">
            <Button data-testid="connect-classroom-cta">Conectar agora</Button>
          </Link>
        </Card>
      </div>
    );
  }

  const skillsRadar = [
    { skill: "Compreensão", value: 78 },
    { skill: "Lógica", value: 82 },
    { skill: "Escrita", value: 71 },
    { skill: "Participação", value: 86 },
    { skill: "Colaboração", value: 74 },
    { skill: "Autonomia", value: 69 },
  ];

  return (
    <div className="space-y-8" data-testid="dashboard-root">
      {/* Header */}
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight">Visão Geral</h1>
          <p className="text-muted-foreground mt-1">Métricas e insights de IA sobre suas turmas em tempo real.</p>
        </div>
        <span className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-medium text-primary">
          <Sparkles className="h-3 w-3" /> Análise IA atualizada há minutos
        </span>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard testId="kpi-alunos" label="Total de Alunos" value={data.kpis.total_alunos} icon={Users} trend={4.2} hint="vs. mês passado" />
        <KpiCard testId="kpi-turmas" label="Turmas Ativas" value={data.kpis.turmas_ativas} icon={BookOpen} trend={2.1} hint="turmas ativas" />
        <KpiCard testId="kpi-tarefas" label="Tarefas Pendentes" value={data.kpis.tarefas_pendentes} icon={ClipboardList} trend={-1.4} hint="a corrigir" />
        <KpiCard testId="kpi-media" label="Média de Desempenho" value={`${data.kpis.media_desempenho}`} icon={TrendingUp} trend={3.6} hint="via IA" />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-6 lg:col-span-2 border border-border">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-display font-semibold text-lg">Desempenho médio (12 semanas)</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Média ponderada dos scores IA por semana.</p>
            </div>
            <span className="text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded-md font-semibold">Tendência positiva</span>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214.3 31.8% 91.4%)" />
                <XAxis dataKey="semana" tick={{ fontSize: 12 }} stroke="hsl(215.4 16.3% 46.9%)" />
                <YAxis domain={[40, 100]} tick={{ fontSize: 12 }} stroke="hsl(215.4 16.3% 46.9%)" />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(214.3 31.8% 91.4%)" }} />
                <Line
                  type="monotone"
                  dataKey="media"
                  stroke="hsl(221 83% 53%)"
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: "hsl(221 83% 53%)" }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6 border border-border">
          <div className="mb-6">
            <h3 className="font-display font-semibold text-lg">Análise de habilidades (IA)</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Perfil médio da turma.</p>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={skillsRadar}>
                <PolarGrid stroke="hsl(214.3 31.8% 91.4%)" />
                <PolarAngleAxis dataKey="skill" tick={{ fontSize: 11 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Radar name="Média" dataKey="value" stroke="hsl(221 83% 53%)" fill="hsl(221 83% 53%)" fillOpacity={0.25} />
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Bottom: Top students + insights */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-6 lg:col-span-2 border border-border">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="font-display font-semibold text-lg">Destaques da IA</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Alunos com melhor desempenho recente.</p>
            </div>
            <Link to="/alunos" className="text-xs text-primary font-semibold inline-flex items-center gap-1 hover:underline">
              Ver todos <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {(data.top_students || []).map((s, i) => (
              <div key={s.id + i} className="flex items-center gap-4 p-3 rounded-lg border border-border hover:bg-muted/40 transition-colors">
                <div className="h-9 w-9 rounded-full bg-blue-50 text-primary text-sm font-semibold flex items-center justify-center flex-shrink-0">
                  {s.name.split(" ").slice(0, 2).map((n) => n[0]).join("")}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{s.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{s.course_name}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="hidden sm:block w-32 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${s.ai_score}%` }} />
                  </div>
                  <span className="text-sm font-semibold tabular-nums w-10 text-right">{s.ai_score}</span>
                </div>
              </div>
            ))}
            {(!data.top_students || data.top_students.length === 0) && (
              <p className="text-sm text-muted-foreground py-6 text-center">Sem alunos ainda.</p>
            )}
          </div>
        </Card>

        <Card className="p-6 border border-border">
          <div className="mb-6 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="font-display font-semibold text-lg">Insights IA</h3>
          </div>
          <div className="space-y-2">
            {(data.insights || []).map((ins, i) => (
              <InsightItem key={i} ins={ins} />
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
