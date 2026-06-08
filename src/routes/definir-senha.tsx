import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { MarcaEstrela } from "@/components/MarcaEstrela";
import { ROXO, ROXO_DARK, ROXO_TINT, ROXO_TINT2, LARANJA, BORDA, CINZA } from "@/lib/recrutamento/data";

export const Route = createFileRoute("/definir-senha")({
  ssr: false,
  head: () => ({ meta: [{ title: "Definir senha · Painel Estrela" }] }),
  component: DefinirSenhaPage,
});

function DefinirSenhaPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState<string>("");
  const [tipo, setTipo] = useState<"invite" | "recovery" | "outro">("outro");
  const [senha, setSenha] = useState("");
  const [senha2, setSenha2] = useState("");
  const [msg, setMsg] = useState<{ type: "err" | "ok"; text: string } | null>(null);

  // Captura tokens do hash (#access_token=...&type=invite|recovery)
  useEffect(() => {
    (async () => {
      try {
        const hash = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : "";
        const params = new URLSearchParams(hash);
        const access_token = params.get("access_token");
        const refresh_token = params.get("refresh_token");
        const type = params.get("type");
        const errDesc = params.get("error_description");

        if (errDesc) {
          setMsg({ type: "err", text: decodeURIComponent(errDesc) });
          setLoading(false);
          return;
        }

        if (access_token && refresh_token) {
          const { error } = await supabase.auth.setSession({ access_token, refresh_token });
          if (error) throw error;
          if (type === "invite") setTipo("invite");
          else if (type === "recovery") setTipo("recovery");
          else setTipo("outro");
          // limpa o hash da URL
          window.history.replaceState(null, "", window.location.pathname);
        }

        const { data: u } = await supabase.auth.getUser();
        if (!u.user) {
          setMsg({ type: "err", text: "Link inválido ou expirado. Peça um novo convite ao administrador." });
          setLoading(false);
          return;
        }
        setEmail(u.user.email ?? "");
        setReady(true);
      } catch (err: any) {
        setMsg({ type: "err", text: err?.message || "Não foi possível validar o link." });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);
    if (senha.length < 8) { setMsg({ type: "err", text: "A senha deve ter pelo menos 8 caracteres." }); return; }
    if (senha !== senha2) { setMsg({ type: "err", text: "As senhas não conferem." }); return; }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: senha });
      if (error) throw error;
      setMsg({ type: "ok", text: "Senha definida com sucesso! Redirecionando..." });
      setTimeout(() => navigate({ to: "/admin", replace: true }), 800);
    } catch (err: any) {
      setMsg({ type: "err", text: err?.message || "Erro ao definir senha." });
    } finally {
      setSaving(false);
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
          <div className="h" style={{ color: "#fff", fontWeight: 800, fontSize: 17 }}>Definir sua senha</div>
        </div>
      </div>

      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
        <form onSubmit={submit} style={{
          background: "#fff", border: `1px solid ${BORDA}`, borderRadius: 18, padding: 28,
          width: "100%", maxWidth: 440, boxShadow: "0 8px 30px -12px rgba(80,50,138,.18)",
        }}>
          <h1 className="h" style={{ fontSize: 22, fontWeight: 800, margin: "0 0 6px" }}>
            {tipo === "recovery" ? "Redefinir senha" : "Bem-vindo(a) ao Painel Estrela"}
          </h1>
          <p style={{ color: CINZA, fontSize: 13, margin: "0 0 20px" }}>
            {tipo === "recovery"
              ? "Crie uma nova senha para acessar o painel."
              : "Este é seu primeiro acesso. Crie uma senha para começar a usar o painel."}
          </p>

          {loading && (
            <div style={{ padding: 14, fontSize: 13, color: CINZA }}>Validando link...</div>
          )}

          {!loading && ready && (
            <>
              {email && (
                <div style={{
                  padding: "9px 12px", borderRadius: 10, marginBottom: 14, fontSize: 13,
                  background: ROXO_TINT, color: ROXO_DARK, border: `1px solid ${BORDA}`,
                }}>
                  Conta: <strong>{email}</strong>
                </div>
              )}
              <label style={{ display: "block", marginBottom: 14 }}>
                <span style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, display: "block" }}>Nova senha</span>
                <input style={input} type="password" required minLength={8} value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Mínimo 8 caracteres" />
              </label>
              <label style={{ display: "block", marginBottom: 14 }}>
                <span style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, display: "block" }}>Confirme a senha</span>
                <input style={input} type="password" required minLength={8} value={senha2} onChange={(e) => setSenha2(e.target.value)} placeholder="Repita a senha" />
              </label>
            </>
          )}

          {msg && (
            <div style={{
              padding: 11, borderRadius: 10, marginBottom: 14, fontSize: 13,
              background: msg.type === "err" ? "#FEF2F2" : "#ECFDF5",
              color: msg.type === "err" ? "#B91C1C" : "#047857",
              border: `1px solid ${msg.type === "err" ? "#FECACA" : "#A7F3D0"}`,
            }}>{msg.text}</div>
          )}

          {!loading && ready && (
            <button type="submit" disabled={saving} style={{
              width: "100%", background: LARANJA, color: "#fff", border: "none",
              padding: "12px 18px", borderRadius: 12, fontSize: 14.5, fontWeight: 700,
              cursor: saving ? "wait" : "pointer", fontFamily: "inherit",
            }}>{saving ? "Salvando..." : "Definir senha e entrar"}</button>
          )}

          {!loading && !ready && (
            <button type="button" onClick={() => navigate({ to: "/auth", replace: true })} style={{
              width: "100%", background: ROXO, color: "#fff", border: "none",
              padding: "12px 18px", borderRadius: 12, fontSize: 14.5, fontWeight: 700,
              cursor: "pointer", fontFamily: "inherit",
            }}>Ir para o login</button>
          )}
        </form>
      </div>
    </div>
  );
}
