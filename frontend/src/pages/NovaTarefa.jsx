import React, { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Send } from "lucide-react";
import { toast } from "sonner";

export default function NovaTarefa() {
  const { id: courseId } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: "",
    description: "",
    max_points: 100,
    due_date: "",
    due_time: "",
  });
  const [saving, setSaving] = useState(false);

  const update = (k, v) => setForm({ ...form, [k]: v });

  const submit = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error("Título é obrigatório");
      return;
    }
    setSaving(true);
    try {
      const res = await api.post(`/classroom/courses/${courseId}/coursework`, form);
      toast.success("Tarefa publicada no Google Classroom!");
      navigate(`/turmas/${courseId}/atividades/${res.data.id}`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Falha ao publicar");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl space-y-8">
      <Link to={`/turmas/${courseId}`} className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-2">
        <ArrowLeft className="h-4 w-4" /> Voltar para turma
      </Link>

      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Nova Tarefa</h1>
        <p className="text-muted-foreground mt-1">Ao publicar, a tarefa aparece imediatamente no Google Classroom para todos os alunos.</p>
      </div>

      <Card className="p-6 border border-border">
        <form onSubmit={submit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium mb-1.5">Título *</label>
            <input
              data-testid="task-title"
              type="text"
              value={form.title}
              onChange={(e) => update("title", e.target.value)}
              placeholder="Ex: Redação sobre democracia"
              className="w-full h-10 px-3 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">Instruções</label>
            <textarea
              data-testid="task-description"
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder="Descreva o que os alunos devem fazer, critérios de avaliação..."
              rows={5}
              className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 resize-y"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">Pontuação máxima</label>
              <input
                data-testid="task-points"
                type="number"
                min={1}
                value={form.max_points}
                onChange={(e) => update("max_points", Number(e.target.value))}
                className="w-full h-10 px-3 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Data limite</label>
              <input
                data-testid="task-due-date"
                type="date"
                value={form.due_date}
                onChange={(e) => update("due_date", e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">Horário</label>
              <input
                data-testid="task-due-time"
                type="time"
                value={form.due_time}
                onChange={(e) => update("due_time", e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <div className="pt-4 flex items-center gap-3">
            <Button data-testid="task-submit" type="submit" disabled={saving} size="lg">
              <Send className="h-4 w-4 mr-1" />
              {saving ? "Publicando..." : "Publicar no Classroom"}
            </Button>
            <Link to={`/turmas/${courseId}`}>
              <Button type="button" variant="outline" size="lg">Cancelar</Button>
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
