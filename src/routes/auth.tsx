import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MarcaEstrela } from "@/components/MarcaEstrela";
import { ROXO, ROXO_DARK, ROXO_TINT, ROXO_TINT2, LARANJA, BORDA, CINZA } from "@/lib/recrutamento/data";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Acesso · Painel Estrela" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "err" | "ok"; text: string } | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) navigate({ to: "/admin", replace: true });
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/admin", replace: true });
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setMsg(null);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/admin` },
        });
        if (error) throw error;
        setMsg({ type: "ok", text: "Cadastro criado! Verifique seu e-mail para confirmar e peça acesso de recrutador a um admin." });
      }
    } catch (err: any) {
      setMsg({ type: "err", text: err.message || "Erro ao autenticar." });
    } finally {
      setLoading(false);
    }
  }

  const input: React.CSSProperties = {
    width: "100%", padding: "11px 13px", border: `1.5px solid ${BORDA}`, borderRadius: 11,
    fontSize: 14, outline: "none", background: "#fff", color: ROXO_DARK, fontFamily: "inherit",
  };

  return (
    <div style={{
      fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
      minHeight: "100vh", display: "flex", flexDirection: "column",
      background: `radial-gradient(120% 80% at 50% -10%, ${ROXO_TINT} 0%, #FBFAFE 45%, #FFFFFF 100%)`,
      color: ROXO_DARK,
    }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        input:focus{border-color:${ROXO}!important;box-shadow:0 0 0 3px ${ROXO_TINT2}}
        .h{font-family:'Outfit',sans-serif}`}</style>

      <div style={{ background: ROXO, padding: "16px 20px", display: "flex", alignItems: "center", gap: 12 }}>
        <MarcaEstrela size={32} branca />
        <div style={{ lineHeight: 1 }}>
          <div className="h" style={{ color: "#fff", fontWeight: 700, letterSpacing: 2, fontSize: 10.5, opacity: 0.85 }}>DISTRIBUIDORA ESTRELA</div>
          <div className="h" style={{ color: "#fff", fontWeight: 800, fontSize: 17 }}>Painel do Recrutador</div>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <form onSubmit={submit} style={{
          background: "#fff", border: `1px solid ${BORDA}`, borderRadius: 18, padding: 28,
          width: "100%", maxWidth: 420, boxShadow: "0 8px 30px -12px rgba(80,50,138,.18)",
        }}>
          <h1 className="h" style={{ fontSize: 22, fontWeight: 800, margin: "0 0 6px" }}>
            {mode === "login" ? "Entrar no painel" : "Criar acesso"}
          </h1>
          <p style={{ color: CINZA, fontSize: 13, margin: "0 0 20px" }}>
            Área restrita ao RH da Distribuidora Estrela.
          </p>

          <label style={{ display: "block", marginBottom: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, display: "block" }}>E-mail</span>
            <input style={input} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@estrela.com.br" />
          </label>
          <label style={{ display: "block", marginBottom: 14 }}>
            <span style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, display: "block" }}>Senha</span>
            <input style={input} type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
          </label>

          {msg && (
            <div style={{
              padding: 11, borderRadius: 10, marginBottom: 14, fontSize: 13,
              background: msg.type === "err" ? "#FEF2F2" : "#ECFDF5",
              color: msg.type === "err" ? "#B91C1C" : "#047857",
              border: `1px solid ${msg.type === "err" ? "#FECACA" : "#A7F3D0"}`,
            }}>{msg.text}</div>
          )}

          <button type="submit" disabled={loading} style={{
            width: "100%", background: LARANJA, color: "#fff", border: "none",
            padding: "12px 18px", borderRadius: 12, fontSize: 14.5, fontWeight: 700,
            cursor: loading ? "wait" : "pointer", fontFamily: "inherit",
          }}>{loading ? "Aguarde..." : mode === "login" ? "Entrar" : "Criar conta"}</button>

          <button type="button" onClick={() => { setMode(mode === "login" ? "signup" : "login"); setMsg(null); }} style={{
            marginTop: 14, width: "100%", background: "none", border: "none",
            color: ROXO, fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
          }}>
            {mode === "login" ? "Não tem conta? Criar acesso" : "Já tem conta? Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
