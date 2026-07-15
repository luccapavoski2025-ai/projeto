import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Link2, Unlink, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";

export default function Configuracoes() {
  const { user, refresh } = useAuth();
  const [params, setParams] = useSearchParams();
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (params.get("classroom") === "connected") {
      toast.success("Google Classroom conectado com sucesso!");
      refresh();
      params.delete("classroom");
      setParams(params, { replace: true });
    }
    const err = params.get("classroom_error");
    if (err) {
      toast.error(`Falha ao conectar: ${err}`, { duration: 12000 });
      params.delete("classroom_error");
      setParams(params, { replace: true });
    }
  }, [params, setParams, refresh]);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await api.get("/classroom/oauth/start");
      window.location.href = res.data.auth_url;
    } catch (e) {
      toast.error("Falha ao iniciar a autorização.");
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    try {
      await api.post("/classroom/disconnect");
      toast.success("Google Classroom desconectado.");
      refresh();
    } catch {
      toast.error("Falha ao desconectar.");
    }
  };

  const connected = user?.classroom_connected;

  return (
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground mt-1">Integrações e preferências da sua conta.</p>
      </div>

      <Card className="p-6 border border-border">
        <div className="flex items-start gap-4">
          <div className="h-11 w-11 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Link2 className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-display font-semibold text-lg">Google Classroom</h3>
              {connected && (
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700">
                  <CheckCircle2 className="h-3 w-3" /> Conectado
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Sincronize suas turmas, alunos e atividades diretamente do Google Classroom. O acesso é somente leitura.
            </p>
            {!connected ? (
              <Button data-testid="connect-classroom-button" onClick={handleConnect} disabled={connecting}>
                {connecting ? "Redirecionando..." : "Conectar Google Classroom"}
              </Button>
            ) : (
              <Button data-testid="disconnect-classroom-button" variant="outline" onClick={handleDisconnect}>
                <Unlink className="h-4 w-4 mr-1" />
                Desconectar
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Card className="p-6 border border-border">
        <div className="flex items-start gap-4">
          <div className="h-11 w-11 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-display font-semibold text-lg">Análise por IA</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Scores, tendências e recomendações são gerados automaticamente com base nos dados do Classroom.
              Perfeito para ter uma visão rápida do desempenho da turma.
            </p>
          </div>
        </div>
      </Card>

      <Card className="p-6 border border-border">
        <div className="flex items-start gap-4">
          <div className="h-11 w-11 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="font-display font-semibold text-lg">Conta</h3>
            <div className="text-sm mt-2 space-y-1">
              <p><span className="text-muted-foreground">Nome:</span> <span className="font-medium">{user?.name}</span></p>
              <p><span className="text-muted-foreground">Email:</span> <span className="font-medium">{user?.email}</span></p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
