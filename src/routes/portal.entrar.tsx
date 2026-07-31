import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
  Sparkles,
  User,
  FileText,
  MailCheck,
  LogOut,
} from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { destinoPorIdentidade } from "@/lib/rotear-identidade";
import {
  garantirContaCandidato,
  TERMO_PORTAL,
  TERMO_PORTAL_VERSAO,
} from "@/lib/portal-candidato.functions";
import { ROXO, ROXO_DARK, ROXO_TINT, LARANJA, CINZA, BORDA } from "@/lib/recrutamento/data";

export const Route = createFileRoute("/portal/entrar")({
  head: () => ({ meta: [{ title: "Portal do Candidato · Entrar" }] }),
  component: PortalEntrarPage,
});

type Modo = "entrar" | "criar" | "esqueci" | "verifique" | "aceite";

// Marca NEUTRA da plataforma (mesma linguagem de /auth — sem marca de tenant).
function MarcaNeutra() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 22 }}>
      <div
        style={{
          width: 42,
          height: 42,
          borderRadius: 12,
          background: `linear-gradient(135deg, ${ROXO} 0%, ${ROXO_DARK} 100%)`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          boxShadow: "0 8px 20px -10px rgba(80,50,138,.5)",
        }}
      >
        <Sparkles size={21} color="#fff" strokeWidth={2.4} />
      </div>
      <div style={{ lineHeight: 1.15 }}>
        <div className="h" style={{ fontWeight: 800, fontSize: 17, letterSpacing: 0.3 }}>
          Recrutamento
        </div>
        <div style={{ fontSize: 11, color: CINZA, letterSpacing: 1.4, textTransform: "uppercase" }}>
          Portal do Candidato
        </div>
      </div>
    </div>
  );
}

function TermoBox({ aberto = false }: { aberto?: boolean }) {
  return (
    <details
      open={aberto}
      style={{
        background: ROXO_TINT,
        border: `1px solid ${BORDA}`,
        borderRadius: 12,
        padding: "12px 14px",
        marginBottom: 14,
      }}
    >
      <summary
        style={{
          cursor: "pointer",
          fontSize: 13,
          fontWeight: 700,
          color: ROXO_DARK,
          display: "flex",
          alignItems: "center",
          gap: 7,
        }}
      >
        <FileText size={15} color={ROXO} style={{ flexShrink: 0 }} /> Termo de uso do portal (versão{" "}
        {TERMO_PORTAL_VERSAO})
      </summary>
      <div
        style={{
          marginTop: 10,
          fontSize: 12.5,
          color: CINZA,
          lineHeight: 1.6,
          whiteSpace: "pre-wrap",
          maxHeight: 220,
          overflowY: "auto",
        }}
      >
        {TERMO_PORTAL}
      </div>
    </details>
  );
}

function CheckAceite({ aceitou, onChange }: { aceitou: boolean; onChange: (v: boolean) => void }) {
  return (
    <label
      style={{
        display: "flex",
        gap: 10,
        alignItems: "flex-start",
        cursor: "pointer",
        marginBottom: 16,
        fontSize: 13,
        lineHeight: 1.55,
        color: CINZA,
      }}
    >
      <input
        type="checkbox"
        checked={aceitou}
        onChange={(e) => onChange(e.target.checked)}
        style={{ marginTop: 2, width: 17, height: 17, accentColor: ROXO, flexShrink: 0 }}
      />
      <span>
        Li e aceito o{" "}
        <strong style={{ color: ROXO_DARK }}>termo de uso do Portal do Candidato</strong> (versão{" "}
        {TERMO_PORTAL_VERSAO}) e o tratamento dos meus dados conforme a LGPD.
      </span>
    </label>
  );
}

function mapAuthErro(err: unknown): string {
  const raw = String((err as any)?.message || "");
  if (/invalid login credentials/i.test(raw)) return "E-mail ou senha incorretos.";
  if (/email not confirmed/i.test(raw))
    return "E-mail ainda não confirmado. Verifique sua caixa de entrada.";
  if (/already registered|already been registered/i.test(raw))
    return "Este e-mail já possui conta. Entre com sua senha.";
  if (/password should be at least|weak password/i.test(raw))
    return "A senha deve ter pelo menos 8 caracteres.";
  if (/too many requests|rate limit|security purposes/i.test(raw))
    return "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
  if (/network|fetch/i.test(raw))
    return "Falha de conexão. Verifique sua internet e tente novamente.";
  return raw || "Algo deu errado. Tente novamente.";
}

function PortalEntrarPage() {
  const navigate = useNavigate();
  const garantirConta = useServerFn(garantirContaCandidato);

  const [modo, setModo] = useState<Modo>("entrar");
  const [checando, setChecando] = useState(true);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [nome, setNome] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [aceitou, setAceitou] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ type: "err" | "ok"; text: string } | null>(null);

  function trocarModo(m: Modo) {
    setModo(m);
    setMsg(null);
  }

  /**
   * Pós-login do candidato: garante a conta do portal (criando com o aceite do
   * termo quando necessário) e só então navega a /portal.
   * - Conta de staff → roteia pela identidade (/super | /admin).
   * - Conta ainda sem aceite → modo "aceite" (re-aceite do termo).
   */
  async function posLogin(aceitouAgora: boolean) {
    try {
      await garantirConta({
        data: {
          nome: nome.trim() || undefined,
          aceitouTermo: aceitouAgora,
          versaoTermo: TERMO_PORTAL_VERSAO,
        },
      });
    } catch (err: any) {
      const raw = String(err?.message || "");
      if (/contas da equipe/i.test(raw)) {
        const destino = await destinoPorIdentidade();
        navigate({ to: destino as any, replace: true });
        return;
      }
      if (/aceitar o termo/i.test(raw)) {
        setAceitou(false);
        setModo("aceite");
        setMsg(null);
        return;
      }
      throw err;
    }
    // "/portal" pode ainda não estar no routeTree gerado — cast até a rota existir.
    navigate({ to: "/portal" as any, replace: true });
  }

  // Já logado ao montar → roteia pela identidade. Sessão órfã (ex.: retorno do
  // link de confirmação de e-mail, antes do aceite) → pede o aceite do termo.
  useEffect(() => {
    let vivo = true;
    (async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!data.session) return;
        const destino = await destinoPorIdentidade();
        if (!vivo) return;
        if (destino === "/auth") {
          setAceitou(false);
          setModo("aceite");
        } else {
          navigate({ to: destino as any, replace: true });
        }
      } finally {
        if (vivo) setChecando(false);
      }
    })();
    return () => {
      vivo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
      if (error) throw error;
      await posLogin(false);
    } catch (err) {
      setMsg({ type: "err", text: mapAuthErro(err) });
    } finally {
      setLoading(false);
    }
  }

  async function criarConta(e: React.FormEvent) {
    e.preventDefault();
    if (!aceitou) {
      setMsg({
        type: "err",
        text: "Para criar a conta é preciso aceitar o termo de uso do portal.",
      });
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password: senha,
        options: {
          emailRedirectTo: window.location.origin + "/portal/entrar",
          data: { nome: nome.trim() },
        },
      });
      if (error) throw error;
      // Anti-enumeração do Supabase: e-mail já cadastrado volta sem erro e sem identities.
      if (data.user && (data.user.identities?.length ?? 0) === 0) {
        setMsg({
          type: "err",
          text: 'Este e-mail já possui conta. Entre com sua senha ou use "Esqueci minha senha".',
        });
        return;
      }
      if (data.session) {
        await posLogin(true);
      } else {
        trocarModo("verifique");
      }
    } catch (err) {
      setMsg({ type: "err", text: mapAuthErro(err) });
    } finally {
      setLoading(false);
    }
  }

  async function reenviarConfirmacao() {
    setLoading(true);
    setMsg(null);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email,
        options: { emailRedirectTo: window.location.origin + "/portal/entrar" },
      });
      if (error) throw error;
      setMsg({ type: "ok", text: "E-mail reenviado. Confira sua caixa de entrada e o spam." });
    } catch (err) {
      setMsg({ type: "err", text: mapAuthErro(err) });
    } finally {
      setLoading(false);
    }
  }

  async function esqueciSenha(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/definir-senha`,
      });
      if (error) throw error;
      setMsg({
        type: "ok",
        text: "Enviamos um link para redefinir sua senha. Verifique seu e-mail.",
      });
    } catch (err) {
      setMsg({ type: "err", text: mapAuthErro(err) });
    } finally {
      setLoading(false);
    }
  }

  async function aceitarTermo() {
    if (!aceitou) {
      setMsg({ type: "err", text: "Marque a caixa de aceite para continuar." });
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      await posLogin(true);
    } catch (err) {
      setMsg({ type: "err", text: mapAuthErro(err) });
    } finally {
      setLoading(false);
    }
  }

  async function sairDoAceite() {
    await supabase.auth.signOut();
    setSenha("");
    setAceitou(false);
    trocarModo("entrar");
  }

  const msgBox = msg && (
    <div
      style={{
        padding: 11,
        borderRadius: 10,
        marginBottom: 14,
        fontSize: 13,
        lineHeight: 1.45,
        background: msg.type === "err" ? "#FEF2F2" : "#ECFDF5",
        color: msg.type === "err" ? "#B91C1C" : "#047857",
        border: `1px solid ${msg.type === "err" ? "#FECACA" : "#A7F3D0"}`,
      }}
    >
      {msg.text}
    </div>
  );

  return (
    <div
      data-portalentrar
      style={{
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        minHeight: "100vh",
        background: `linear-gradient(180deg, ${ROXO_TINT} 0%, #fff 46%)`,
        color: ROXO_DARK,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "32px 18px 26px",
      }}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        .h{font-family:'Outfit',sans-serif}
        [data-portalentrar] input:focus{border-color:${ROXO}!important;box-shadow:0 0 0 4px rgba(80,50,138,.12)}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>

      <div style={{ width: "100%", maxWidth: 430 }}>
        <MarcaNeutra />

        <div
          style={{
            background: "#fff",
            border: `1px solid ${BORDA}`,
            borderRadius: 18,
            boxShadow: "0 8px 30px -12px rgba(80,50,138,.18)",
            padding: 24,
          }}
        >
          {checando ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 9,
                padding: "28px 0",
                color: CINZA,
                fontSize: 13.5,
              }}
            >
              <Loader2 size={17} style={{ animation: "spin 1s linear infinite" }} /> Verificando sua
              sessão…
            </div>
          ) : modo === "entrar" ? (
            <form onSubmit={entrar}>
              <h1 className="h" style={{ fontSize: 22, fontWeight: 800, margin: "0 0 6px" }}>
                Acompanhe sua candidatura
              </h1>
              <p style={{ color: CINZA, fontSize: 13.5, margin: "0 0 22px", lineHeight: 1.5 }}>
                Entre com o e-mail usado na sua inscrição.
              </p>
              <CampoInput
                icon={Mail}
                label="E-mail"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="voce@email.com"
                autoComplete="email"
              />
              <CampoSenha
                value={senha}
                onChange={setSenha}
                show={showPass}
                onToggle={() => setShowPass((s) => !s)}
                autoComplete="current-password"
              />
              {msgBox}
              <BotaoPrimario loading={loading} texto="Entrar" />
              <button type="button" onClick={() => trocarModo("esqueci")} style={linkBtn}>
                Esqueci minha senha
              </button>
              <div style={divisor} />
              <p style={{ fontSize: 13, color: CINZA, textAlign: "center", margin: 0 }}>
                Primeira vez aqui?{" "}
                <button type="button" onClick={() => trocarModo("criar")} style={linkForte}>
                  Criar conta
                </button>
              </p>
            </form>
          ) : modo === "criar" ? (
            <form onSubmit={criarConta}>
              <h1 className="h" style={{ fontSize: 22, fontWeight: 800, margin: "0 0 6px" }}>
                Criar sua conta
              </h1>
              <p style={{ color: CINZA, fontSize: 13.5, margin: "0 0 22px", lineHeight: 1.5 }}>
                Use o <strong style={{ color: ROXO_DARK }}>mesmo e-mail da sua inscrição</strong>{" "}
                para encontrarmos suas candidaturas.
              </p>
              <CampoInput
                icon={User}
                label="Nome completo"
                type="text"
                value={nome}
                onChange={setNome}
                placeholder="Seu nome"
                autoComplete="name"
              />
              <CampoInput
                icon={Mail}
                label="E-mail"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="voce@email.com"
                autoComplete="email"
              />
              <CampoSenha
                value={senha}
                onChange={setSenha}
                show={showPass}
                onToggle={() => setShowPass((s) => !s)}
                autoComplete="new-password"
                minLength={8}
                hint="Mínimo de 8 caracteres."
              />
              <TermoBox />
              <CheckAceite aceitou={aceitou} onChange={setAceitou} />
              {msgBox}
              <BotaoPrimario loading={loading} texto="Criar conta" />
              <div style={divisor} />
              <p style={{ fontSize: 13, color: CINZA, textAlign: "center", margin: 0 }}>
                Já tem conta?{" "}
                <button type="button" onClick={() => trocarModo("entrar")} style={linkForte}>
                  Entrar
                </button>
              </p>
            </form>
          ) : modo === "esqueci" ? (
            <form onSubmit={esqueciSenha}>
              <h1 className="h" style={{ fontSize: 22, fontWeight: 800, margin: "0 0 6px" }}>
                Recuperar senha
              </h1>
              <p style={{ color: CINZA, fontSize: 13.5, margin: "0 0 22px", lineHeight: 1.5 }}>
                Enviaremos um link de redefinição para o seu e-mail.
              </p>
              <CampoInput
                icon={Mail}
                label="E-mail"
                type="email"
                value={email}
                onChange={setEmail}
                placeholder="voce@email.com"
                autoComplete="email"
              />
              {msgBox}
              <BotaoPrimario loading={loading} texto="Enviar link" />
              <button type="button" onClick={() => trocarModo("entrar")} style={linkBtn}>
                Voltar para entrar
              </button>
            </form>
          ) : modo === "verifique" ? (
            <div style={{ textAlign: "center" }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  background: ROXO_TINT,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "4px auto 16px",
                }}
              >
                <MailCheck size={26} color={ROXO} />
              </div>
              <h1 className="h" style={{ fontSize: 22, fontWeight: 800, margin: "0 0 8px" }}>
                Verifique seu e-mail
              </h1>
              <p style={{ color: CINZA, fontSize: 13.5, margin: "0 0 20px", lineHeight: 1.6 }}>
                Enviamos um link de confirmação para{" "}
                <strong style={{ color: ROXO_DARK, overflowWrap: "anywhere" }}>{email}</strong>.
                Abra o link para ativar sua conta e acessar o portal.
              </p>
              {msgBox}
              <button
                type="button"
                onClick={reenviarConfirmacao}
                disabled={loading}
                style={{
                  width: "100%",
                  background: "#fff",
                  color: ROXO,
                  border: `1.5px solid ${ROXO}`,
                  padding: "12px 18px",
                  borderRadius: 12,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: loading ? "wait" : "pointer",
                  fontFamily: "inherit",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                {loading ? (
                  <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} />
                ) : (
                  "Reenviar e-mail"
                )}
              </button>
              <button type="button" onClick={() => trocarModo("entrar")} style={linkBtn}>
                Voltar para entrar
              </button>
            </div>
          ) : (
            // modo === "aceite": sessão ativa sem conta do portal (ou termo desatualizado)
            <div>
              <h1 className="h" style={{ fontSize: 22, fontWeight: 800, margin: "0 0 6px" }}>
                Termo de uso do portal
              </h1>
              <p style={{ color: CINZA, fontSize: 13.5, margin: "0 0 18px", lineHeight: 1.5 }}>
                Para ativar seu acesso ao portal, leia e aceite o termo abaixo.
              </p>
              <TermoBox aberto />
              <CheckAceite aceitou={aceitou} onChange={setAceitou} />
              {msgBox}
              <button
                type="button"
                onClick={aceitarTermo}
                disabled={loading}
                style={btnPrimarioStyle(loading)}
              >
                {loading ? (
                  <Loader2 size={17} style={{ animation: "spin 1s linear infinite" }} />
                ) : (
                  <>
                    Aceitar e continuar <ArrowRight size={17} />
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={sairDoAceite}
                style={{
                  ...linkBtn,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <LogOut size={14} /> Sair
              </button>
            </div>
          )}
        </div>

        {/* Acesso da equipe (rota /auth já existe no routeTree — âncora simples por simetria). */}
        <div style={{ marginTop: 16, textAlign: "center" }}>
          <a
            href="/auth"
            style={{
              color: CINZA,
              fontSize: 12.5,
              fontWeight: 500,
              textDecoration: "underline",
              textUnderlineOffset: 3,
            }}
          >
            É da equipe da empresa? Entre pelo painel
          </a>
        </div>

        <div
          style={{
            marginTop: 18,
            textAlign: "center",
            fontSize: 11.5,
            color: "#9b93b0",
            lineHeight: 1.5,
          }}
        >
          Os dados são tratados em conformidade com a <strong style={{ color: CINZA }}>LGPD</strong>{" "}
          (Lei 13.709/2018).
        </div>
      </div>
    </div>
  );
}

// ===== Primitivos visuais (mesma linguagem de /auth e /c/$token) =====

function CampoInput({
  icon: Icon,
  label,
  type,
  value,
  onChange,
  placeholder,
  autoComplete,
}: {
  icon: any;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoComplete?: string;
}) {
  return (
    <label style={{ display: "block", marginBottom: 15 }}>
      <span style={{ fontSize: 13, fontWeight: 600, marginBottom: 7, display: "block" }}>
        {label}
      </span>
      <div style={{ position: "relative" }}>
        <Icon
          size={17}
          color="#9b93b0"
          style={{
            position: "absolute",
            left: 13,
            top: "50%",
            transform: "translateY(-50%)",
            pointerEvents: "none",
          }}
        />
        <input
          style={{ ...inp, paddingLeft: 40 }}
          type={type}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          autoComplete={autoComplete}
        />
      </div>
    </label>
  );
}

function CampoSenha({
  value,
  onChange,
  show,
  onToggle,
  autoComplete,
  minLength,
  hint,
}: {
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
  autoComplete: string;
  minLength?: number;
  hint?: string;
}) {
  return (
    <label style={{ display: "block", marginBottom: 16 }}>
      <span style={{ fontSize: 13, fontWeight: 600, marginBottom: 7, display: "block" }}>
        Senha
      </span>
      <div style={{ position: "relative" }}>
        <Lock
          size={17}
          color="#9b93b0"
          style={{
            position: "absolute",
            left: 13,
            top: "50%",
            transform: "translateY(-50%)",
            pointerEvents: "none",
          }}
        />
        <input
          style={{ ...inp, paddingLeft: 40, paddingRight: 42 }}
          type={show ? "text" : "password"}
          required
          minLength={minLength}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="••••••••"
          autoComplete={autoComplete}
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={show ? "Ocultar senha" : "Mostrar senha"}
          style={{
            position: "absolute",
            right: 6,
            top: "50%",
            transform: "translateY(-50%)",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 8,
            color: "#9b93b0",
            display: "flex",
          }}
        >
          {show ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
      {hint && (
        <span style={{ fontSize: 11.5, color: "#9b93b0", marginTop: 5, display: "block" }}>
          {hint}
        </span>
      )}
    </label>
  );
}

function BotaoPrimario({ loading, texto }: { loading: boolean; texto: string }) {
  return (
    <button type="submit" disabled={loading} style={btnPrimarioStyle(loading)}>
      {loading ? (
        <Loader2 size={17} style={{ animation: "spin 1s linear infinite" }} />
      ) : (
        <>
          {texto} <ArrowRight size={17} />
        </>
      )}
    </button>
  );
}

const btnPrimarioStyle = (loading: boolean): React.CSSProperties => ({
  width: "100%",
  background: `linear-gradient(180deg, ${LARANJA} 0%, #d94e12 100%)`,
  color: "#fff",
  border: "none",
  padding: "13px 18px",
  borderRadius: 12,
  fontSize: 15,
  fontWeight: 700,
  cursor: loading ? "wait" : "pointer",
  fontFamily: "inherit",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  minHeight: 48,
  boxShadow: `0 10px 22px -10px ${LARANJA}`,
});

const linkBtn: React.CSSProperties = {
  marginTop: 14,
  width: "100%",
  background: "none",
  border: "none",
  color: ROXO,
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  fontFamily: "inherit",
  padding: 6,
};

const linkForte: React.CSSProperties = {
  background: "none",
  border: "none",
  color: ROXO,
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "inherit",
  padding: 0,
  textDecoration: "underline",
  textUnderlineOffset: 3,
};

const divisor: React.CSSProperties = {
  height: 1,
  background: BORDA,
  margin: "18px 0 14px",
};

const inp: React.CSSProperties = {
  width: "100%",
  padding: "12px 13px",
  border: `1.5px solid ${BORDA}`,
  borderRadius: 12,
  fontSize: 14,
  outline: "none",
  background: "#fff",
  color: ROXO_DARK,
  fontFamily: "inherit",
  boxSizing: "border-box",
  transition: "border-color .15s, box-shadow .15s",
};
