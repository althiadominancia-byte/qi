import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Mail, Lock, Eye, EyeOff, Loader2, ArrowRight,
  Sparkles, ShieldCheck, Target, Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ROXO, ROXO_DARK, LARANJA, BORDA, CINZA } from "@/lib/recrutamento/data";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Entrar · Plataforma de Recrutamento" }] }),
  component: AuthPage,
});

// Marca neutra da plataforma (não é da Estrela). A paleta usa var(--brand-*),
// então cada tenant pode sobrescrever as cores mantendo este layout.
function MarcaPlataforma({ size = 40 }: { size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: size * 0.28, flexShrink: 0,
      background: "linear-gradient(135deg, #fff 0%, rgba(255,255,255,.82) 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: "0 6px 18px -8px rgba(0,0,0,.35)",
    }}>
      <Sparkles size={size * 0.5} color={ROXO} strokeWidth={2.4} />
    </div>
  );
}

const DESTAQUES = [
  { icon: Sparkles, titulo: "Análise de currículo com IA", texto: "O CV é lido por IA e recebe uma nota de match contra a vaga." },
  { icon: Target, titulo: "Match automático da vaga", texto: "DISC, questões situacionais e perfil combinados em um só score." },
  { icon: ShieldCheck, titulo: "Multiempresa e LGPD", texto: "Isolamento por empresa e tratamento de dados em conformidade." },
];

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "err" | "ok"; text: string } | null>(null);

  // Roteia por papel: super_admin → gestão (/super); demais → painel do recrutador (/admin).
  async function rotearPorPapel(userId: string) {
    const { data: u } = await supabase
      .from("usuarios").select("role").eq("id", userId).maybeSingle();
    navigate({ to: u?.role === "super_admin" ? "/super" : "/admin", replace: true });
  }

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) rotearPorPapel(session.user.id);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) rotearPorPapel(data.session.user.id);
    });
    return () => subscription.unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setMsg(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err: any) {
      const raw = String(err?.message || "");
      let text = "Erro ao autenticar.";
      if (/invalid login credentials/i.test(raw)) text = "E-mail ou senha incorretos.";
      else if (/email not confirmed/i.test(raw)) text = "E-mail ainda não confirmado. Verifique sua caixa de entrada.";
      else if (/too many requests|rate limit/i.test(raw)) text = "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
      else if (/network|fetch/i.test(raw)) text = "Falha de conexão. Verifique sua internet e tente novamente.";
      else if (raw) text = raw;
      setMsg({ type: "err", text });
    } finally {
      setLoading(false);
    }
  }

  async function esqueciSenha() {
    if (!email) { setMsg({ type: "err", text: "Informe seu e-mail acima para receber o link." }); return; }
    setLoading(true); setMsg(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/definir-senha`,
      });
      if (error) throw error;
      setMsg({ type: "ok", text: "Enviamos um link para redefinir sua senha. Verifique seu e-mail." });
    } catch (err: any) {
      setMsg({ type: "err", text: err.message || "Erro ao enviar link." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div data-authroot style={{
      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      minHeight: "100vh", display: "grid", gridTemplateColumns: "1.05fr 1fr",
      color: ROXO_DARK, background: "#fff",
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        .h{font-family:'Outfit',sans-serif}
        [data-authroot] input:focus{border-color:${ROXO}!important;box-shadow:0 0 0 4px ${ROXO}1a}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes floatglow{0%,100%{transform:translate(0,0)}50%{transform:translate(14px,-18px)}}
        @media(max-width:900px){
          [data-authroot]{grid-template-columns:1fr!important}
          [data-brandpanel]{display:none!important}
          [data-formwrap]{padding:28px 22px!important}
        }
      `}</style>

      {/* ===== Painel de marca (esquerda) ===== */}
      <div data-brandpanel style={{
        position: "relative", overflow: "hidden", color: "#fff",
        background: `linear-gradient(150deg, ${ROXO_DARK} 0%, ${ROXO} 62%, ${ROXO_DARK} 130%)`,
        padding: "48px 52px", display: "flex", flexDirection: "column",
      }}>
        {/* brilhos decorativos */}
        <div style={{ position: "absolute", top: -120, right: -90, width: 340, height: 340, borderRadius: "50%", background: `radial-gradient(circle, ${LARANJA}55 0%, transparent 68%)`, animation: "floatglow 9s ease-in-out infinite" }} />
        <div style={{ position: "absolute", bottom: -140, left: -100, width: 380, height: 380, borderRadius: "50%", background: "radial-gradient(circle, rgba(255,255,255,.14) 0%, transparent 66%)" }} />

        <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 13 }}>
          <MarcaPlataforma size={44} />
          <div style={{ lineHeight: 1.15 }}>
            <div className="h" style={{ fontWeight: 800, fontSize: 18, letterSpacing: 0.3 }}>Recrutamento</div>
            <div style={{ fontSize: 12, opacity: 0.72, letterSpacing: 1.5, textTransform: "uppercase" }}>Plataforma de Seleção</div>
          </div>
        </div>

        <div style={{ position: "relative", margin: "auto 0" }}>
          <h1 className="h" style={{ fontSize: 38, lineHeight: 1.12, fontWeight: 800, margin: "0 0 16px", maxWidth: 460 }}>
            Do anúncio à contratação, em uma só plataforma.
          </h1>
          <p style={{ fontSize: 15, lineHeight: 1.65, opacity: 0.82, maxWidth: 420, margin: "0 0 34px" }}>
            Gerencie vagas, candidatos e a estrutura da sua empresa com avaliação
            inteligente de perfil e match automático.
          </p>

          <div style={{ display: "grid", gap: 16, maxWidth: 440 }}>
            {DESTAQUES.map(({ icon: Ic, titulo, texto }) => (
              <div key={titulo} style={{ display: "flex", gap: 13, alignItems: "flex-start" }}>
                <div style={{ width: 38, height: 38, borderRadius: 11, background: "rgba(255,255,255,.14)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "1px solid rgba(255,255,255,.16)" }}>
                  <Ic size={18} color="#fff" />
                </div>
                <div>
                  <div className="h" style={{ fontWeight: 700, fontSize: 14.5 }}>{titulo}</div>
                  <div style={{ fontSize: 13, opacity: 0.76, lineHeight: 1.5 }}>{texto}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ position: "relative", fontSize: 12, opacity: 0.6, display: "flex", alignItems: "center", gap: 7 }}>
          <Users size={13} /> Acesso restrito · concedido por convite do administrador
        </div>
      </div>

      {/* ===== Formulário (direita) ===== */}
      <div data-formwrap style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 56px" }}>
        <form onSubmit={submit} style={{ width: "100%", maxWidth: 380 }}>
          {/* marca compacta (visível principalmente no mobile) */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 30 }}>
            <div style={{ width: 40, height: 40, borderRadius: 11, background: `linear-gradient(135deg, ${ROXO} 0%, ${ROXO_DARK} 100%)`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Sparkles size={20} color="#fff" strokeWidth={2.4} />
            </div>
            <div className="h" style={{ fontWeight: 800, fontSize: 17 }}>Recrutamento</div>
          </div>

          <h2 className="h" style={{ fontSize: 25, fontWeight: 800, margin: "0 0 6px" }}>Entrar no painel</h2>
          <p style={{ color: CINZA, fontSize: 13.5, margin: "0 0 26px", lineHeight: 1.5 }}>
            Acesse o painel da sua empresa com o e-mail cadastrado.
          </p>

          <label style={{ display: "block", marginBottom: 15 }}>
            <span style={{ fontSize: 13, fontWeight: 600, marginBottom: 7, display: "block" }}>E-mail</span>
            <div style={{ position: "relative" }}>
              <Mail size={17} color="#9b93b0" style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
              <input style={{ ...inp, paddingLeft: 40 }} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@empresa.com.br" autoComplete="email" />
            </div>
          </label>

          <label style={{ display: "block", marginBottom: 18 }}>
            <span style={{ fontSize: 13, fontWeight: 600, marginBottom: 7, display: "block" }}>Senha</span>
            <div style={{ position: "relative" }}>
              <Lock size={17} color="#9b93b0" style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }} />
              <input style={{ ...inp, paddingLeft: 40, paddingRight: 42 }} type={showPass ? "text" : "password"} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
              <button type="button" onClick={() => setShowPass((s) => !s)} aria-label={showPass ? "Ocultar senha" : "Mostrar senha"}
                style={{ position: "absolute", right: 6, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", padding: 8, color: "#9b93b0", display: "flex" }}>
                {showPass ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
          </label>

          {msg && (
            <div style={{
              padding: 11, borderRadius: 10, marginBottom: 16, fontSize: 13, lineHeight: 1.45,
              background: msg.type === "err" ? "#FEF2F2" : "#ECFDF5",
              color: msg.type === "err" ? "#B91C1C" : "#047857",
              border: `1px solid ${msg.type === "err" ? "#FECACA" : "#A7F3D0"}`,
            }}>{msg.text}</div>
          )}

          <button type="submit" disabled={loading} style={{
            width: "100%", background: `linear-gradient(180deg, ${LARANJA} 0%, #d94e12 100%)`, color: "#fff", border: "none",
            padding: "13px 18px", borderRadius: 12, fontSize: 15, fontWeight: 700,
            cursor: loading ? "wait" : "pointer", fontFamily: "inherit",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            boxShadow: `0 10px 22px -10px ${LARANJA}`,
          }}>
            {loading ? <Loader2 size={17} style={{ animation: "spin 1s linear infinite" }} /> : <>Entrar <ArrowRight size={17} /></>}
          </button>

          <button type="button" onClick={esqueciSenha} disabled={loading} style={{
            marginTop: 16, width: "100%", background: "none", border: "none",
            color: ROXO, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
          }}>
            Esqueci minha senha
          </button>

          <div style={{ marginTop: 28, textAlign: "center", fontSize: 11.5, color: "#9b93b0", lineHeight: 1.5 }}>
            Os dados são tratados em conformidade com a <strong style={{ color: CINZA }}>LGPD</strong>.
          </div>
        </form>
      </div>
    </div>
  );
}

const inp: React.CSSProperties = {
  width: "100%", padding: "12px 13px", border: `1.5px solid ${BORDA}`, borderRadius: 12,
  fontSize: 14, outline: "none", background: "#fff", color: ROXO_DARK, fontFamily: "inherit",
  boxSizing: "border-box", transition: "border-color .15s, box-shadow .15s",
};
