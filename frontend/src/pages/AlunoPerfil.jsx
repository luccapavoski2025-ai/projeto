import React from "react";
import { useParams, Link } from "react-router-dom";
import useSWR from "swr";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Sparkles, TrendingUp, Award, AlertTriangle } from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from "recharts";
import { cn } from "@/lib/utils";

const fetcher = (url) => api.get(url).then((r) => r.data);

const riskStyle = {
  Baixo: "bg-emerald-50 text-emerald-700",
  Moderado: "bg-amber-50 text-amber-700",
  Alto: "bg-rose-50 text-rose-700",
};

export default function AlunoPerfil() {
  const { id } = useParams();
  const { data, isLoading, error } = useSWR(`/students/${id}`, fetcher);

  if (isLoading) return <div className="text-muted-foreground">Carregando aluno...</div>;
  if (error) return <div className="text-destructive">Erro ao carregar.</div>;

  const s = data;
  const skillsData = Object.entries(s.ai.skills).map(([skill, value]) => ({ skill, value }));

  return (
    <div className="space-y-8">
      <Link to="/alunos" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-2">
        <ArrowLeft className="h-4 w-4" /> Voltar para alunos
      </Link>

      {/* Header */}
      <Card className="p-6 border border-border">
        <div className="flex items-start gap-5 flex-wrap">
          <div className="h-16 w-16 rounded-full bg-blue-50 text-primary text-lg font-semibold flex items-center justify-center flex-shrink-0">
            {s.name.split(" ").slice(0, 2).map((n) => n[0]).join("")}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-2xl font-bold">{s.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">{s.email}</p>
            <div className="flex flex-wrap gap-2 mt-3">
              {s.courses.map((c) => (
                <span key={c.id} className="text-xs px-2.5 py-1 rounded-md bg-muted text-foreground/80">
                  {c.name}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Score IA</p>
              <p className="font-display text-3xl font-bold text-primary">{s.ai.overall_score}</p>
            </div>
            <div>
              <span className={cn("inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full", riskStyle[s.ai.risk_level])}>
                {s.ai.risk_level === "Alto" ? <AlertTriangle className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                Risco {s.ai.risk_level}
              </span>
            </div>
          </div>
        </div>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-6 border border-border">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h3 className="font-display font-semibold text-lg">Evolução (8 semanas)</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Notas ponderadas pela IA.</p>
            </div>
            <Award className="h-5 w-5 text-primary" />
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={s.ai.trend}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(214.3 31.8% 91.4%)" />
                <XAxis dataKey="semana" tick={{ fontSize: 12 }} stroke="hsl(215.4 16.3% 46.9%)" />
                <YAxis domain={[40, 100]} tick={{ fontSize: 12 }} stroke="hsl(215.4 16.3% 46.9%)" />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid hsl(214.3 31.8% 91.4%)" }} />
                <Line type="monotone" dataKey="nota" stroke="hsl(221 83% 53%)" strokeWidth={2.5} dot={{ r: 3, fill: "hsl(221 83% 53%)" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-6 border border-border">
          <div className="mb-4">
            <h3 className="font-display font-semibold text-lg">Habilidades (Radar IA)</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Análise por dimensão cognitiva e comportamental.</p>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={skillsData}>
                <PolarGrid stroke="hsl(214.3 31.8% 91.4%)" />
                <PolarAngleAxis dataKey="skill" tick={{ fontSize: 11 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Radar dataKey="value" stroke="hsl(221 83% 53%)" fill="hsl(221 83% 53%)" fillOpacity={0.3} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Insights */}
      <Card className="p-6 border border-border">
        <div className="mb-4 flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <h3 className="font-display font-semibold text-lg">Recomendações da IA</h3>
        </div>
        <div className="space-y-3">
          {s.ai.insights.map((text, i) => (
            <div key={i} className="p-4 rounded-lg border border-border bg-gradient-to-r from-blue-50/40 to-transparent">
              <p className="text-sm">{text}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
