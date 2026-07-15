import React, { useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import useSWR from "swr";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Sparkles, CheckCircle2, AlertTriangle, Info, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";

const fetcher = (url) => api.get(url).then((r) => r.data);

function extractStudentText(sub) {
  // Try to extract text from submission attachments (short answer or text)
  const short = sub?.shortAnswerSubmission?.answer;
  if (short) return short;
  const attachments = sub?.assignmentSubmission?.attachments || [];
  const links = attachments.map((a) => {
    if (a.driveFile) return `[Google Drive] ${a.driveFile.title}`;
    if (a.link) return `[Link] ${a.link.title || a.link.url}`;
    if (a.youTubeVideo) return `[YouTube] ${a.youTubeVideo.title}`;
    if (a.form) return `[Formulário] ${a.form.title}`;
    return "";
  }).filter(Boolean);
  return links.join("\n") || "";
}

export default function CorrecaoEntrega() {
  const { courseId, cwId, subId } = useParams();
  const navigate = useNavigate();
  const { data: sub, isLoading } = useSWR(
    `/classroom/courses/${courseId}/coursework/${cwId}/submissions/${subId}`,
    fetcher
  );

  const [studentText, setStudentText] = useState("");
  const [aiFeedback, setAiFeedback] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [finalGrade, setFinalGrade] = useState("");
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    if (sub) {
      setStudentText(extractStudentText(sub));
      if (sub.assignedGrade != null) setFinalGrade(String(sub.assignedGrade));
    }
  }, [sub]);

  const runAI = async () => {
    if (!studentText.trim()) {
      toast.error("Cole ou digite o texto do aluno para a IA analisar.");
      return;
    }
    setAiLoading(true);
    setAiFeedback(null);
    try {
      const res = await api.post("/ai/grade-help", {
        assignment_title: sub._coursework?.title || "",
        assignment_description: sub._coursework?.description || "",
        max_points: sub._coursework?.maxPoints || 100,
        student_text: studentText,
        student_name: sub._student?.name || "Aluno",
      });
      setAiFeedback(res.data);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Falha na análise da IA");
    } finally {
      setAiLoading(false);
    }
  };

  const submitGrade = async () => {
    const g = Number(finalGrade);
    const max = sub._coursework?.maxPoints || 100;
    if (Number.isNaN(g) || g < 0 || g > max) {
      toast.error(`Nota deve estar entre 0 e ${max}`);
      return;
    }
    setSubmitting(true);
    try {
      await api.post(`/classroom/courses/${courseId}/coursework/${cwId}/submissions/${subId}/grade`, {
        assigned_grade: g,
        return_to_student: true,
      });
      toast.success("Nota lançada e devolvida ao aluno!");
      navigate(`/turmas/${courseId}/atividades/${cwId}`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Falha ao lançar nota");
    } finally {
      setSubmitting(false);
    }
  };

  if (isLoading || !sub) return <div className="text-muted-foreground">Carregando...</div>;

  const max = sub._coursework?.maxPoints || 100;

  return (
    <div className="space-y-6">
      <Link to={`/turmas/${courseId}/atividades/${cwId}`} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-2">
        <ArrowLeft className="h-4 w-4" /> Voltar para lista de entregas
      </Link>

      {/* Header */}
      <Card className="p-6 border border-border">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-blue-50 text-primary text-sm font-semibold flex items-center justify-center">
            {(sub._student?.name || "?").split(" ").slice(0, 2).map((n) => n[0]).join("")}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-primary font-semibold uppercase tracking-wider">Entrega de</p>
            <h1 className="font-display text-2xl font-bold">{sub._student?.name}</h1>
            <p className="text-sm text-muted-foreground">{sub._coursework?.title}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground uppercase tracking-wider">Estado</p>
            <p className="text-sm font-semibold">{sub.state}</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: submission text */}
        <Card className="p-6 border border-border">
          <h3 className="font-display font-semibold text-lg mb-3">Entrega do aluno</h3>
          <p className="text-xs text-muted-foreground mb-3">
            Se a entrega for um arquivo do Drive, cole o conteúdo textual aqui para a IA analisar.
          </p>
          <textarea
            data-testid="student-text"
            value={studentText}
            onChange={(e) => setStudentText(e.target.value)}
            rows={16}
            className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 resize-y font-mono"
            placeholder="Texto entregue pelo aluno..."
          />
          <Button
            data-testid="ai-analyze"
            onClick={runAI}
            disabled={aiLoading}
            className="mt-4"
          >
            {aiLoading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
            {aiLoading ? "Analisando..." : "Analisar com IA"}
          </Button>
        </Card>

        {/* Right: AI feedback + grade */}
        <div className="space-y-6">
          <Card className="p-6 border border-border">
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-4 w-4 text-primary" />
              <h3 className="font-display font-semibold text-lg">Análise da IA</h3>
            </div>

            {!aiFeedback && !aiLoading && (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Clique em "Analisar com IA" para obter dicas de correção. A IA sugere, mas você decide.
              </p>
            )}

            {aiLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 text-primary animate-spin" />
                <span className="ml-2 text-sm text-muted-foreground">Claude analisando...</span>
              </div>
            )}

            {aiFeedback && (
              <div className="space-y-4">
                {aiFeedback.strengths?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wider mb-2 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> Pontos fortes
                    </p>
                    <ul className="space-y-1.5">
                      {aiFeedback.strengths.map((s, i) => (
                        <li key={i} className="text-sm pl-4 relative">
                          <span className="absolute left-0 top-2 h-1 w-1 rounded-full bg-emerald-500" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {aiFeedback.improvements?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-2 flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" /> A melhorar
                    </p>
                    <ul className="space-y-1.5">
                      {aiFeedback.improvements.map((s, i) => (
                        <li key={i} className="text-sm pl-4 relative">
                          <span className="absolute left-0 top-2 h-1 w-1 rounded-full bg-amber-500" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {aiFeedback.key_checkpoints?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-2 flex items-center gap-1">
                      <Info className="h-3 w-3" /> Verifique manualmente
                    </p>
                    <ul className="space-y-1.5">
                      {aiFeedback.key_checkpoints.map((s, i) => (
                        <li key={i} className="text-sm pl-4 relative">
                          <span className="absolute left-0 top-2 h-1 w-1 rounded-full bg-blue-500" />
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {aiFeedback.suggested_range && (
                  <div className="p-3 rounded-lg bg-blue-50/50 border border-blue-100">
                    <p className="text-xs font-semibold text-primary uppercase tracking-wider">Faixa sugerida (não é a nota final)</p>
                    <p className="text-lg font-display font-bold text-primary mt-1">
                      {aiFeedback.suggested_range.min} – {aiFeedback.suggested_range.max} / {max}
                    </p>
                    {aiFeedback.reasoning && <p className="text-xs text-muted-foreground mt-1">{aiFeedback.reasoning}</p>}
                  </div>
                )}

                <div className="p-3 rounded-lg bg-amber-50 border border-amber-200">
                  <p className="text-xs font-semibold text-amber-800">⚠ Lembrete</p>
                  <p className="text-xs text-amber-800 mt-1">{aiFeedback.professor_reminder}</p>
                </div>
              </div>
            )}
          </Card>

          {/* Final grade — teacher decides */}
          <Card className="p-6 border-2 border-primary/30">
            <h3 className="font-display font-semibold text-lg mb-1">Sua nota final</h3>
            <p className="text-xs text-muted-foreground mb-4">Você tem a palavra final. Ao lançar, a nota é enviada ao Google Classroom.</p>
            <div className="flex items-center gap-3">
              <input
                data-testid="final-grade"
                type="number"
                min={0}
                max={max}
                step="0.5"
                value={finalGrade}
                onChange={(e) => setFinalGrade(e.target.value)}
                placeholder="0"
                className="h-12 w-24 px-3 rounded-lg border border-border bg-white text-lg font-display font-bold focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <span className="text-lg text-muted-foreground">/ {max}</span>
              <Button
                data-testid="submit-grade"
                onClick={submitGrade}
                disabled={submitting || !finalGrade}
                size="lg"
                className="ml-auto"
              >
                <Send className="h-4 w-4 mr-1" />
                {submitting ? "Lançando..." : "Lançar nota"}
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
