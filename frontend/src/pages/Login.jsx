import React, { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { GraduationCap, Sparkles, LineChart, ShieldCheck } from "lucide-react";
import { useAuth } from "@/lib/auth";

const LOGIN_BG = "https://images.unsplash.com/photo-1518005108369-12a8b1c429a0?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1MDZ8MHwxfHNlYXJjaHwxfHxibHVlJTIwYW5kJTIwd2hpdGUlMjBtb2Rlcm4lMjBhcmNoaXRlY3R1cmUlMjBidWlsZGluZ3xlbnwwfHx8fDE3ODQxNDQzMTl8MA&ixlib=rb-4.1.0&q=85";

export default function Login() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading && user) navigate("/home", { replace: true });
  }, [user, loading, navigate]);

  const handleGoogleLogin = () => {
    // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
    const redirectUrl = window.location.origin + "/home";
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-white">
      {/* Left visual panel */}
      <div className="relative hidden lg:block overflow-hidden">
        <img
          src={LOGIN_BG}
          alt="Arquitetura moderna"
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-blue-900/70 via-blue-700/50 to-blue-500/40" />
        <div className="relative z-10 flex flex-col justify-between h-full p-12 text-white">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center border border-white/20">
              <GraduationCap className="h-5 w-5" />
            </div>
            <span className="font-display font-bold text-xl tracking-tight">EduCRM</span>
          </div>

          <div className="space-y-6 max-w-md">
            <h1 className="font-display text-4xl xl:text-5xl font-bold leading-tight">
              O CRM que entende o seu aluno.
            </h1>
            <p className="text-blue-50/90 text-base leading-relaxed">
              Turmas do Google Classroom, métricas em tempo real e insights de IA — tudo em um só lugar para o professor moderno.
            </p>
            <div className="grid grid-cols-1 gap-3 pt-4">
              {[
                { icon: Sparkles, text: "Insights de IA por aluno" },
                { icon: LineChart, text: "Dashboards de desempenho" },
                { icon: ShieldCheck, text: "Login Google seguro" },
              ].map(({ icon: Icon, text }, i) => (
                <div key={i} className="flex items-center gap-3 text-sm text-blue-50/95">
                  <div className="h-8 w-8 rounded-md bg-white/10 border border-white/20 flex items-center justify-center">
                    <Icon className="h-4 w-4" />
                  </div>
                  {text}
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-white/60">© {new Date().getFullYear()} EduCRM • Para educadores.</p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex flex-col justify-center px-6 sm:px-16 lg:px-20 py-16">
        <div className="max-w-md w-full mx-auto">
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-primary" />
            </div>
            <span className="font-display font-bold text-xl tracking-tight">EduCRM</span>
          </div>

          <div className="mb-10">
            <span className="inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-xs font-medium text-primary mb-6">
              <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Nova temporada letiva 2026
            </span>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground mb-3">
              Bem-vindo(a) de volta, professor(a).
            </h2>
            <p className="text-muted-foreground">
              Entre com sua conta Google institucional para acessar suas turmas e o dashboard de desempenho.
            </p>
          </div>

          <Button
            data-testid="login-google-button"
            onClick={handleGoogleLogin}
            className="w-full h-12 text-base font-medium"
            size="lg"
          >
            <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
              <path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#fff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" opacity=".85"/>
              <path fill="#fff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" opacity=".7"/>
              <path fill="#fff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" opacity=".5"/>
            </svg>
            Entrar com o Google
          </Button>

          <p className="text-xs text-muted-foreground mt-6 leading-relaxed">
            Ao continuar, você concorda com nossos <span className="text-primary font-medium">Termos</span> e a{" "}
            <span className="text-primary font-medium">Política de Privacidade</span>. Somente contas de professor podem acessar o CRM.
          </p>
        </div>
      </div>
    </div>
  );
}
