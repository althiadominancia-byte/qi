import { createFileRoute, Outlet, useChildMatches, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertCircle,
  Briefcase,
  Building2,
  CalendarClock,
  ClipboardList,
  CheckCircle2,
  ChevronRight,
  Link2,
  Loader2,
  Mail,
  Send,
  ShieldCheck,
  UserRound,
  X,
} from "lucide-react";
import {
  garantirContaCandidato,
  getMeuPortal,
  listarCandidaturasReivindicaveis,
  reivindicarCandidatura,
  TERMO_PORTAL,
  TERMO_PORTAL_VERSAO,
  excluirMinhaConta,
  aplicarPerfilNaCandidatura,
  listarMeusConvites,
  responderConvite,
} from "@/lib/portal-candidato.functions";
import { supabase } from "@/integrations/supabase/client";
import {
  ROXO,
  ROXO_DARK,
  ROXO_TINT,
  LARANJA,
  CINZA,
  BORDA,
  VERDE,
  VERMELHO,
} from "@/lib/recrutamento/data";

// /portal — painel do candidato: lista de candidaturas + vínculo de candidaturas
// feitas antes da conta existir (reivindicação por e-mail + 4 dígitos do celular).
// O guard de sessão fica no layout pai (_candidato/route.tsx).
export const Route = createFileRoute("/_candidato/portal")({
  ssr: false,
  head: () => ({ meta: [{ title: "Portal do Candidato" }] }),
  component: PortalPage,
});

// ===== Cor do badge por etapa (única visão permitida ao candidato) =====
const COR_ETAPA: Record<string, string> = {
  "Em análise": CINZA,
  Entrevista: LARANJA,
  Contratado: VERDE,
  "Processo encerrado": CINZA,
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "11px 13px",
  border: `1.5px solid ${BORDA}`,
  borderRadius: 11,
  fontSize: 14,
  outline: "none",
  background: "#fff",
  color: ROXO_DARK,
  boxSizing: "border-box",
  fontFamily: "inherit",
};
const btnPrimario = (habilitado: boolean): React.CSSProperties => ({
  background: habilitado ? ROXO : "#D8D2E6",
  color: "#fff",
  border: "none",
  padding: "12px 20px",
  borderRadius: 12,
  fontSize: 14.5,
  fontWeight: 700,
  cursor: habilitado ? "pointer" : "not-allowed",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
  fontFamily: "inherit",
  minHeight: 46,
});

function Card({ children }: any) {
  return (
    <div
      data-card
      style={{
        background: "#fff",
        borderRadius: 18,
        padding: 22,
        border: `1px solid ${BORDA}`,
        boxShadow: "0 8px 30px -12px rgba(80,50,138,.18)",
        marginBottom: 14,
      }}
    >
      {children}
    </div>
  );
}
function BadgeEtapa({ etapa }: { etapa: string }) {
  const cor = COR_ETAPA[etapa] ?? CINZA;
  return (
    <span
      style={{
        fontSize: 11.5,
        fontWeight: 700,
        color: cor,
        background: `color-mix(in srgb, ${cor} 12%, white)`,
        border: `1px solid color-mix(in srgb, ${cor} 30%, white)`,
        padding: "4px 10px",
        borderRadius: 99,
        whiteSpace: "nowrap",
      }}
    >
      {etapa}
    </span>
  );
}
// Conteúdo da página (o header/rodapé vêm do layout _candidato/route.tsx).
function Pagina({ children }: any) {
  return (
    <div
      style={{
        background: `radial-gradient(120% 80% at 50% -10%, ${ROXO_TINT} 0%, #FBFAFE 45%, #FFFFFF 100%)`,
        color: ROXO_DARK,
        padding: "0 0 48px",
        minHeight: "100%",
      }}
    >
      <style>{`*{box-sizing:border-box} html,body{overflow-x:hidden;max-width:100vw}
        input:focus,select:focus,textarea:focus{border-color:${ROXO}!important}
        @keyframes spin{to{transform:rotate(360deg)}} .spin{animation:spin 1s linear infinite}
        @media (max-width:640px){
          input,select,textarea{font-size:16px !important}
          [data-pad]{padding:0 12px !important}
          [data-card]{padding:16px !important;border-radius:14px !important}
        }
      `}</style>
      <div data-pad style={{ maxWidth: 720, margin: "0 auto", padding: "0 18px" }}>
        {children}
      </div>
    </div>
  );
}
function Modal({ children, onClose }: { children: any; onClose?: () => void }) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(30,18,55,.55)",
        zIndex: 60,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 18,
          padding: 22,
          width: "100%",
          maxWidth: 480,
          maxHeight: "88vh",
          overflowY: "auto",
          position: "relative",
        }}
      >
        {onClose && (
          <button
            onClick={onClose}
            aria-label="Fechar"
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              background: "none",
              border: "none",
              cursor: "pointer",
              color: CINZA,
              padding: 4,
            }}
          >
            <X size={18} />
          </button>
        )}
        {children}
      </div>
    </div>
  );
}

// Modal de aceite do termo — usado no primeiro acesso e no re-aceite de versão nova.
function ModalTermo({
  titulo,
  onAceitar,
  aceitando,
  erro,
  onClose,
}: {
  titulo: string;
  onAceitar: () => void;
  aceitando: boolean;
  erro: string;
  onClose?: () => void;
}) {
  const [marcado, setMarcado] = useState(false);
  return (
    <Modal onClose={onClose}>
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
        <ShieldCheck size={20} color={ROXO} />
        <h2 className="h" style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>
          {titulo}
        </h2>
      </div>
      <div
        style={{
          background: ROXO_TINT,
          borderRadius: 12,
          padding: 14,
          fontSize: 12.5,
          color: CINZA,
          lineHeight: 1.6,
          whiteSpace: "pre-wrap",
          maxHeight: 260,
          overflowY: "auto",
          marginBottom: 14,
        }}
      >
        {TERMO_PORTAL}
      </div>
      <label
        style={{
          display: "flex",
          gap: 9,
          alignItems: "flex-start",
          fontSize: 13,
          color: ROXO_DARK,
          lineHeight: 1.5,
          marginBottom: 14,
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={marcado}
          onChange={(e) => setMarcado(e.target.checked)}
          style={{ marginTop: 2 }}
        />
        <span>
          Li e aceito o termo de uso do Portal do Candidato (versão {TERMO_PORTAL_VERSAO}).
        </span>
      </label>
      {erro && (
        <div
          style={{
            fontSize: 12.5,
            color: "#B91C1C",
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            borderRadius: 10,
            padding: 10,
            marginBottom: 12,
          }}
        >
          {erro}
        </div>
      )}
      <button
        onClick={onAceitar}
        disabled={!marcado || aceitando}
        style={{ ...btnPrimario(marcado && !aceitando), width: "100%" }}
      >
        {aceitando ? <Loader2 size={16} className="spin" /> : <CheckCircle2 size={16} />} Aceitar e
        continuar
      </button>
    </Modal>
  );
}

function PortalPage() {
  // portal.$id.tsx é rota FILHA desta (convenção de arquivos do TanStack Router):
  // quando o detalhe está aberto, esta página renderiza só o <Outlet />.
  const filhos = useChildMatches();
  if (filhos.length > 0) return <Outlet />;
  return <ListaCandidaturas />;
}

function ListaCandidaturas() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchPortal = useServerFn(getMeuPortal);
  const fetchReiv = useServerFn(listarCandidaturasReivindicaveis);
  const garantir = useServerFn(garantirContaCandidato);
  const reivindicar = useServerFn(reivindicarCandidatura);

  const portalQ = useQuery({
    queryKey: ["meu-portal"],
    queryFn: () => fetchPortal() as Promise<any>,
    retry: false,
  });
  const reivQ = useQuery({
    queryKey: ["candidaturas-reivindicaveis"],
    queryFn: () => fetchReiv() as Promise<any[]>,
    enabled: portalQ.isSuccess,
    retry: false,
  });

  // Aceite do termo (primeiro acesso ou re-aceite de versão nova)
  const [aceitando, setAceitando] = useState(false);
  const [erroAceite, setErroAceite] = useState("");
  const [mostrarComecar, setMostrarComecar] = useState(false);

  // Reivindicação
  const [reivAberta, setReivAberta] = useState<{ id: string; vaga_titulo: string | null } | null>(
    null,
  );
  const [digitos, setDigitos] = useState("");
  const [vinculando, setVinculando] = useState(false);
  const [erroVinculo, setErroVinculo] = useState("");

  // Exclusão de conta (LGPD art. 18 — prometida no termo de uso)
  const [excluirAberto, setExcluirAberto] = useState(false);
  const [confirmaTexto, setConfirmaTexto] = useState("");
  const [excluindo, setExcluindo] = useState(false);
  const [erroExcluir, setErroExcluir] = useState("");
  const apagarConta = useServerFn(excluirMinhaConta);
  const projPerfil = useServerFn(aplicarPerfilNaCandidatura);
  const fetchConvites = useServerFn(listarMeusConvites);
  const responder = useServerFn(responderConvite);
  const convitesQ = useQuery({
    queryKey: ["meus-convites"],
    queryFn: () => fetchConvites() as Promise<any>,
    retry: false,
  });
  const [respondendo, setRespondendo] = useState<string | null>(null);
  const [conviteErro, setConviteErro] = useState("");
  async function onResponderConvite(conviteId: string, aceitar: boolean) {
    setRespondendo(conviteId);
    try {
      const r: any = await responder({ data: { conviteId, aceitar } as any });
      if (r?.aceito && r?.candidatoId) {
        // Projeta o perfil neutro na nova candidatura (mesmo padrão do vínculo).
        projPerfil({ data: { candidatoId: r.candidatoId } }).catch(() => {});
        await qc.invalidateQueries({ queryKey: ["meu-portal"] });
      }
      await qc.invalidateQueries({ queryKey: ["meus-convites"] });
    } catch (e: any) {
      setConviteErro(e?.message || "Não foi possível responder o convite.");
    } finally {
      setRespondendo(null);
    }
  }
  async function excluirConta() {
    if (excluindo || confirmaTexto.trim().toUpperCase() !== "EXCLUIR") return;
    setExcluindo(true);
    setErroExcluir("");
    try {
      await apagarConta({ data: { confirmacao: "EXCLUIR" } });
      try {
        await supabase.auth.signOut();
      } catch {
        /* sessão já invalidada */
      }
      navigate({ to: "/portal/entrar" as any, replace: true });
    } catch (e: any) {
      setErroExcluir(e?.message || "Não foi possível excluir agora. Tente novamente.");
      setExcluindo(false);
    }
  }

  async function aceitarTermo() {
    setAceitando(true);
    setErroAceite("");
    try {
      await garantir({ data: { aceitouTermo: true, versaoTermo: TERMO_PORTAL_VERSAO } });
      setMostrarComecar(false);
      await qc.invalidateQueries({ queryKey: ["meu-portal"] });
      await qc.invalidateQueries({ queryKey: ["candidaturas-reivindicaveis"] });
    } catch (e: any) {
      setErroAceite(e?.message || "Não foi possível registrar o aceite. Tente novamente.");
    } finally {
      setAceitando(false);
    }
  }

  async function vincular() {
    if (!reivAberta || digitos.length !== 4 || vinculando) return;
    setVinculando(true);
    setErroVinculo("");
    try {
      const idVinculado = reivAberta.id;
      await reivindicar({ data: { candidatoId: idVinculado, celularDigitos: digitos } });
      setReivAberta(null);
      // Projeção do perfil neutro na candidatura recém-vinculada (best-effort).
      projPerfil({ data: { candidatoId: idVinculado } }).catch(() => {});
      setDigitos("");
      await qc.invalidateQueries({ queryKey: ["meu-portal"] });
      await qc.invalidateQueries({ queryKey: ["candidaturas-reivindicaveis"] });
    } catch (e: any) {
      // Erros do servidor (dígitos errados, rate-limit, configuração insegura) aparecem aqui.
      setErroVinculo(e?.message || "Não foi possível vincular a candidatura.");
    } finally {
      setVinculando(false);
    }
  }

  if (portalQ.isLoading) {
    return (
      <Pagina>
        <div style={{ margin: "48px auto", textAlign: "center", color: CINZA, fontSize: 14 }}>
          <Loader2 size={22} className="spin" style={{ marginBottom: 8 }} />{" "}
          <div>Carregando suas candidaturas...</div>
        </div>
      </Pagina>
    );
  }

  // ===== Erros de identidade =====
  const erroMsg = String((portalQ.error as any)?.message || "");
  if (portalQ.isError && /Conta de candidato não encontrada/i.test(erroMsg)) {
    // Usuário logado mas ainda sem conta do portal: fluxo de "começar" com aceite do termo.
    return (
      <Pagina>
        <div style={{ marginTop: 28 }}>
          <Card>
            <div style={{ textAlign: "center", padding: "8px 0" }}>
              <div
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: 99,
                  background: ROXO_TINT,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 12,
                }}
              >
                <UserRound size={28} color={ROXO} />
              </div>
              <h1 className="h" style={{ fontSize: 22, fontWeight: 800, margin: "0 0 8px" }}>
                Bem-vindo(a) ao Portal do Candidato
              </h1>
              <p style={{ color: CINZA, fontSize: 14, lineHeight: 1.6, margin: "0 0 18px" }}>
                Aqui você acompanha suas candidaturas, vê sua entrevista e mantém seus dados
                atualizados. Para começar, é só aceitar o termo de uso.
              </p>
              <button
                onClick={() => {
                  setErroAceite("");
                  setMostrarComecar(true);
                }}
                style={btnPrimario(true)}
              >
                Começar <ChevronRight size={16} />
              </button>
            </div>
          </Card>
        </div>
        {mostrarComecar && (
          <ModalTermo
            titulo="Termo de uso do portal"
            onAceitar={aceitarTermo}
            aceitando={aceitando}
            erro={erroAceite}
            onClose={() => setMostrarComecar(false)}
          />
        )}
      </Pagina>
    );
  }
  if (portalQ.isError && /Contas da equipe/i.test(erroMsg)) {
    return (
      <Pagina>
        <div style={{ marginTop: 28 }}>
          <Card>
            <div style={{ textAlign: "center", padding: "8px 0" }}>
              <AlertCircle size={34} color={LARANJA} />
              <h1 className="h" style={{ fontSize: 20, fontWeight: 800, margin: "10px 0 6px" }}>
                Esta área é para candidatos
              </h1>
              <p style={{ color: CINZA, fontSize: 14, lineHeight: 1.6, margin: "0 0 16px" }}>
                Sua conta faz parte da equipe da empresa. Use o painel administrativo.
              </p>
              <a href="/admin" style={{ ...btnPrimario(true), textDecoration: "none" }}>
                Ir para o painel <ChevronRight size={16} />
              </a>
            </div>
          </Card>
        </div>
      </Pagina>
    );
  }
  if (portalQ.isError) {
    return (
      <Pagina>
        <div style={{ marginTop: 28 }}>
          <Card>
            <div style={{ textAlign: "center", padding: "8px 0" }}>
              <AlertCircle size={34} color={LARANJA} />
              <h1 className="h" style={{ fontSize: 20, fontWeight: 800, margin: "10px 0 6px" }}>
                Não foi possível carregar
              </h1>
              <p style={{ color: CINZA, fontSize: 13.5, lineHeight: 1.6, margin: "0 0 16px" }}>
                {erroMsg || "Tente novamente em instantes."}
              </p>
              <button onClick={() => portalQ.refetch()} style={btnPrimario(true)}>
                Tentar de novo
              </button>
            </div>
          </Card>
        </div>
      </Pagina>
    );
  }

  const candidaturas: any[] = portalQ.data?.candidaturas ?? [];
  const reivindicaveis: any[] = reivQ.data ?? [];
  const vazio = candidaturas.length === 0 && reivindicaveis.length === 0 && !reivQ.isLoading;

  return (
    <Pagina>
      <div style={{ margin: "24px 0 0" }}>
        <h1 className="h" style={{ fontSize: 24, fontWeight: 800, margin: "0 0 4px" }}>
          Minhas candidaturas
        </h1>
        <p style={{ color: CINZA, fontSize: 13.5, margin: "0 0 18px", lineHeight: 1.55 }}>
          Acompanhe aqui cada vaga em que você se inscreveu.
        </p>

        {/* Sua agenda — entrevistas marcadas em todas as candidaturas */}
        {candidaturas.filter(
          (c) =>
            c.portal_ativo &&
            c.entrevista &&
            ["Agendada", "Em andamento", "Agendada (sem gravação)"].includes(
              c.entrevista.status_rotulo,
            ),
        ).length > 0 && (
          <div
            style={{
              background: ROXO,
              borderRadius: 16,
              padding: 16,
              marginBottom: 14,
              color: "#fff",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <CalendarClock size={16} color={LARANJA} />
              <span className="h" style={{ fontWeight: 800, fontSize: 15 }}>
                Sua agenda
              </span>
            </div>
            {candidaturas
              .filter(
                (c) =>
                  c.portal_ativo &&
                  c.entrevista &&
                  ["Agendada", "Em andamento", "Agendada (sem gravação)"].includes(
                    c.entrevista.status_rotulo,
                  ),
              )
              .map((c) => (
                <div
                  key={c.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    flexWrap: "wrap",
                    background: "rgba(255,255,255,.08)",
                    borderRadius: 12,
                    padding: "11px 13px",
                    marginBottom: 8,
                  }}
                >
                  <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 800 }}>
                      Entrevista — {c.vaga_titulo || "Vaga"}
                    </div>
                    <div style={{ fontSize: 12, opacity: 0.85 }}>
                      {c.empresa_nome || "Empresa"}
                      {c.entrevista.agendada_para
                        ? ` · ${fmtDataHora(c.entrevista.agendada_para)}`
                        : ""}
                      {c.entrevista.status_rotulo === "Em andamento" ? " · acontecendo agora" : ""}
                    </div>
                  </div>
                  {c.entrevista.link_token ? (
                    <a
                      href={`/e/${c.entrevista.link_token}`}
                      target="_blank"
                      rel="noopener"
                      style={{
                        background: LARANJA,
                        color: "#fff",
                        borderRadius: 10,
                        padding: "9px 15px",
                        fontSize: 12.5,
                        fontWeight: 800,
                        textDecoration: "none",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Entrar na sala →
                    </a>
                  ) : (
                    <span style={{ fontSize: 12, fontWeight: 700, opacity: 0.85 }}>
                      {c.entrevista.status_rotulo}
                    </span>
                  )}
                </div>
              ))}
          </div>
        )}

        {/* Meu perfil (Cadastro Neutro) — o perfil é da pessoa, vale p/ todas as vagas */}
        <button
          onClick={() => navigate({ to: "/portal/perfil" as any })}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            width: "100%",
            textAlign: "left",
            background: ROXO_TINT,
            border: `1.5px solid ${ROXO}33`,
            borderRadius: 16,
            padding: "14px 16px",
            marginBottom: 14,
            cursor: "pointer",
            fontFamily: "inherit",
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: ROXO,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <UserRound size={20} color="#fff" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="h" style={{ fontWeight: 800, fontSize: 15, color: ROXO_DARK }}>
              Meu perfil
            </div>
            <div style={{ fontSize: 12.5, color: CINZA }}>
              Conte sua história uma vez — vale para todas as vagas.
            </div>
          </div>
          <ChevronRight size={18} color={ROXO} />
        </button>

        {/* Convites de empresas (modelo empresa-puxa) */}
        {(convitesQ.data?.convites ?? []).filter((cv: any) => cv.status === "pendente").length >
          0 && (
          <div
            style={{
              background: "#fff",
              border: `1.5px solid ${LARANJA}55`,
              borderRadius: 16,
              padding: 16,
              marginBottom: 14,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 10,
              }}
            >
              <Send size={16} color={LARANJA} />
              <span className="h" style={{ fontWeight: 800, fontSize: 15, color: ROXO_DARK }}>
                Você foi convidado(a)!
              </span>
            </div>
            {conviteErro && (
              <div
                style={{
                  fontSize: 12.5,
                  color: "#B91C1C",
                  background: "#FEF2F2",
                  border: "1px solid #FECACA",
                  borderRadius: 10,
                  padding: 10,
                  marginBottom: 10,
                }}
              >
                {conviteErro}
              </div>
            )}
            {(convitesQ.data?.convites ?? [])
              .filter((cv: any) => cv.status === "pendente")
              .map((cv: any) => (
                <div
                  key={cv.id}
                  style={{
                    border: `1px solid ${BORDA}`,
                    borderRadius: 12,
                    padding: "12px 14px",
                    marginBottom: 8,
                  }}
                >
                  <div style={{ fontSize: 14, fontWeight: 800, color: ROXO_DARK }}>
                    {cv.vaga?.titulo ?? "Vaga"}
                    {cv.vaga?.setor ? ` — ${cv.vaga.setor}` : ""}
                  </div>
                  <div style={{ fontSize: 12.5, color: CINZA, margin: "2px 0 8px" }}>
                    {cv.empresa?.nome ?? "Empresa"} viu seu perfil no banco de talentos e quer você
                    no processo.
                  </div>
                  {cv.mensagem && (
                    <div
                      style={{
                        fontSize: 12.5,
                        color: ROXO_DARK,
                        background: ROXO_TINT,
                        borderRadius: 10,
                        padding: "8px 10px",
                        marginBottom: 10,
                        lineHeight: 1.5,
                      }}
                    >
                      “{cv.mensagem}”
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    <button
                      onClick={() => onResponderConvite(cv.id, true)}
                      disabled={respondendo === cv.id}
                      style={{
                        background: respondendo === cv.id ? "#D8D2E6" : ROXO,
                        color: "#fff",
                        border: "none",
                        padding: "9px 16px",
                        borderRadius: 10,
                        fontSize: 12.5,
                        fontWeight: 700,
                        cursor: respondendo === cv.id ? "wait" : "pointer",
                        fontFamily: "inherit",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                      }}
                    >
                      {respondendo === cv.id ? (
                        <Loader2 size={13} className="spin" />
                      ) : (
                        <CheckCircle2 size={13} />
                      )}
                      Aceitar e participar
                    </button>
                    <button
                      onClick={() => onResponderConvite(cv.id, false)}
                      disabled={respondendo === cv.id}
                      style={{
                        background: "none",
                        border: `1.5px solid ${BORDA}`,
                        color: CINZA,
                        padding: "9px 14px",
                        borderRadius: 10,
                        fontSize: 12.5,
                        fontWeight: 600,
                        cursor: "pointer",
                        fontFamily: "inherit",
                      }}
                    >
                      Agora não
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}

        {/* Pendências — o que falta fazer, com atalho direto */}
        {(() => {
          const flags = portalQ.data?.perfil_flags;
          const pend: { chave: string; texto: string; destino: () => void }[] = [];
          if (flags && !flags.tem_celular) {
            pend.push({
              chave: "celular",
              texto: "Complete seus dados — as empresas precisam do seu celular",
              destino: () => navigate({ to: "/portal/perfil" as any }),
            });
          }
          if (flags && !flags.tem_cv) {
            pend.push({
              chave: "cv",
              texto: "Envie ou crie seu currículo no seu perfil",
              destino: () => navigate({ to: "/portal/perfil" as any }),
            });
          }
          for (const c of candidaturas) {
            if (!c.portal_ativo || !c.pendencias) continue;
            if (c.pendencias.avaliacoes) {
              pend.push({
                chave: `av-${c.id}`,
                texto: `Responda as avaliações da vaga ${c.vaga_titulo || ""}`.trim(),
                destino: () => navigate({ to: "/portal/$id" as any, params: { id: c.id } as any }),
              });
            }
            if (c.pendencias.video) {
              pend.push({
                chave: `vid-${c.id}`,
                texto: `Grave seu vídeo de apresentação — ${c.vaga_titulo || "vaga"}`,
                destino: () => navigate({ to: "/portal/$id" as any, params: { id: c.id } as any }),
              });
            }
          }
          if (!pend.length) return null;
          return (
            <div
              style={{
                background: "#fff",
                border: `1px solid ${BORDA}`,
                borderRadius: 16,
                padding: 16,
                marginBottom: 14,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                <ClipboardList size={16} color={ROXO} />
                <span className="h" style={{ fontWeight: 800, fontSize: 15, color: ROXO_DARK }}>
                  Pendências
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: "#fff",
                    background: LARANJA,
                    borderRadius: 99,
                    padding: "2px 8px",
                  }}
                >
                  {pend.length}
                </span>
              </div>
              {pend.map((item) => (
                <button
                  key={item.chave}
                  onClick={item.destino}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    width: "100%",
                    textAlign: "left",
                    background: "none",
                    border: "none",
                    borderBottom: `1px solid ${BORDA}`,
                    padding: "10px 2px",
                    cursor: "pointer",
                    fontFamily: "inherit",
                  }}
                >
                  <span style={{ fontSize: 13, color: ROXO_DARK, flex: 1, lineHeight: 1.45 }}>
                    {item.texto}
                  </span>
                  <ChevronRight size={15} color={CINZA} style={{ flexShrink: 0 }} />
                </button>
              ))}
            </div>
          );
        })()}

        {/* Candidaturas vinculadas */}
        {candidaturas.map((c) =>
          c.portal_ativo ? (
            <button
              key={c.id}
              onClick={() => navigate({ to: "/portal/$id" as any, params: { id: c.id } as any })}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                width: "100%",
                textAlign: "left",
                background: "#fff",
                border: `1px solid ${BORDA}`,
                borderRadius: 16,
                padding: "16px 16px",
                marginBottom: 10,
                cursor: "pointer",
                fontFamily: "inherit",
                boxShadow: "0 8px 30px -14px rgba(80,50,138,.18)",
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 11,
                  background: ROXO_TINT,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Briefcase size={19} color={ROXO} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 12,
                    color: CINZA,
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    marginBottom: 2,
                  }}
                >
                  <Building2 size={12} /> {c.empresa_nome || "Empresa"}
                </div>
                <div
                  className="h"
                  style={{
                    fontSize: 15.5,
                    fontWeight: 800,
                    color: ROXO_DARK,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {c.vaga_titulo || "Vaga"}
                </div>
                {c.entrevista?.agendada_para && c.etapa_mapeada === "Entrevista" && (
                  <div style={{ fontSize: 12, color: LARANJA, fontWeight: 700, marginTop: 3 }}>
                    Entrevista: {fmtDataHora(c.entrevista.agendada_para)}
                  </div>
                )}
              </div>
              <BadgeEtapa etapa={c.etapa_mapeada || "Em análise"} />
              <ChevronRight size={17} color={CINZA} style={{ flexShrink: 0 }} />
            </button>
          ) : (
            // Empresa sem o portal habilitado: a candidatura continua visível (LGPD),
            // mas sem os recursos do portal.
            <div
              key={c.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                background: "#fff",
                border: `1px dashed ${BORDA}`,
                borderRadius: 16,
                padding: "14px 16px",
                marginBottom: 10,
                opacity: 0.85,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 11,
                  background: "#F4F3F6",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Briefcase size={19} color={CINZA} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, color: CINZA, marginBottom: 2 }}>
                  {c.empresa_nome || "Empresa"}
                </div>
                <div className="h" style={{ fontSize: 15, fontWeight: 800, color: ROXO_DARK }}>
                  {c.vaga_titulo || "Vaga"}
                </div>
                <div style={{ fontSize: 12, color: CINZA, marginTop: 3 }}>
                  Acompanhamento direto com a empresa.
                </div>
              </div>
            </div>
          ),
        )}

        {/* Candidaturas reivindicáveis (mesmo e-mail, ainda sem dono) */}
        {reivindicaveis.length > 0 && (
          <Card>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
              <Mail size={17} color={LARANJA} />
              <h2 className="h" style={{ fontSize: 16, fontWeight: 800, margin: 0 }}>
                Encontramos candidaturas para o seu e-mail
              </h2>
            </div>
            <p style={{ color: CINZA, fontSize: 13, lineHeight: 1.55, margin: "0 0 12px" }}>
              Você se inscreveu nessas vagas antes de criar sua conta. Para vincular, confirme os 4
              últimos dígitos do celular que você informou na inscrição.
            </p>
            {reivindicaveis.map((r) => (
              <div
                key={r.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  border: `1px solid ${BORDA}`,
                  borderRadius: 12,
                  padding: "11px 13px",
                  marginBottom: 8,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, color: CINZA }}>{r.empresa_nome || "Empresa"}</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: ROXO_DARK }}>
                    {r.vaga_titulo || "Vaga"}
                  </div>
                </div>
                <button
                  onClick={() => {
                    setReivAberta({ id: r.id, vaga_titulo: r.vaga_titulo });
                    setDigitos("");
                    setErroVinculo("");
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    background: "#fff",
                    color: ROXO,
                    border: `1.5px solid ${BORDA}`,
                    padding: "8px 13px",
                    borderRadius: 10,
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    flexShrink: 0,
                  }}
                >
                  <Link2 size={13} /> Vincular
                </button>
              </div>
            ))}
          </Card>
        )}
        {reivQ.isError && (
          <div style={{ fontSize: 12.5, color: LARANJA, fontWeight: 600, margin: "4px 2px 12px" }}>
            {String(
              (reivQ.error as any)?.message ||
                "Não foi possível verificar candidaturas antigas do seu e-mail.",
            )}
          </div>
        )}

        {/* Empty-state */}
        {vazio && (
          <Card>
            <div style={{ textAlign: "center", padding: "10px 0" }}>
              <div
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: 99,
                  background: ROXO_TINT,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 12,
                }}
              >
                <Briefcase size={26} color={ROXO} />
              </div>
              <h2 className="h" style={{ fontSize: 18, fontWeight: 800, margin: "0 0 8px" }}>
                Nenhuma candidatura por aqui ainda
              </h2>
              <p style={{ color: CINZA, fontSize: 13.5, lineHeight: 1.6, margin: "0 0 16px" }}>
                Quando você se inscrever em uma vaga usando <strong>este mesmo e-mail</strong>, a
                candidatura aparece aqui automaticamente. Se você já se inscreveu com outro e-mail,
                entre com aquele e-mail para encontrá-la.
              </p>
              <button
                onClick={() => {
                  portalQ.refetch();
                  reivQ.refetch();
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: "#fff",
                  color: ROXO,
                  border: `1.5px solid ${BORDA}`,
                  padding: "10px 16px",
                  borderRadius: 11,
                  fontSize: 13.5,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Atualizar
              </button>
            </div>
          </Card>
        )}

        {/* Zona de exclusão — discreta, mas acessível (termo de uso, item 3) */}
        <div style={{ textAlign: "center", marginTop: 26 }}>
          <button
            onClick={() => {
              setExcluirAberto(true);
              setConfirmaTexto("");
              setErroExcluir("");
            }}
            style={{
              background: "none",
              border: "none",
              color: "#9b93b0",
              fontSize: 12,
              cursor: "pointer",
              fontFamily: "inherit",
              textDecoration: "underline",
            }}
          >
            Excluir minha conta
          </button>
        </div>
      </div>

      {/* Modal de exclusão de conta */}
      {excluirAberto && (
        <Modal onClose={() => (!excluindo ? setExcluirAberto(false) : undefined)}>
          <h2
            className="h"
            style={{ fontSize: 17, fontWeight: 800, margin: "0 0 10px", color: VERMELHO }}
          >
            Excluir minha conta
          </h2>
          <div style={{ color: CINZA, fontSize: 13, lineHeight: 1.6, marginBottom: 12 }}>
            <p style={{ margin: "0 0 8px" }}>Ao excluir sua conta:</p>
            <ul style={{ margin: 0, paddingLeft: 18 }}>
              <li>seu acesso ao portal é apagado definitivamente;</li>
              <li>seus vídeos de apresentação são removidos;</li>
              <li>
                as candidaturas já enviadas permanecem com as empresas — para excluí-las, fale
                diretamente com a empresa da vaga (LGPD, art. 18).
              </li>
            </ul>
          </div>
          <p style={{ fontSize: 12.5, color: CINZA, margin: "0 0 8px" }}>
            Para confirmar, digite <strong>EXCLUIR</strong>:
          </p>
          <input
            style={{ ...inputStyle, textAlign: "center", fontWeight: 700, letterSpacing: 2 }}
            value={confirmaTexto}
            onChange={(e) => setConfirmaTexto(e.target.value)}
            placeholder="EXCLUIR"
            autoComplete="off"
          />
          {erroExcluir && (
            <div
              style={{
                marginTop: 10,
                fontSize: 12.5,
                color: "#B91C1C",
                background: "#FEF2F2",
                border: "1px solid #FECACA",
                borderRadius: 10,
                padding: 10,
              }}
            >
              {erroExcluir}
            </div>
          )}
          <button
            onClick={excluirConta}
            disabled={excluindo || confirmaTexto.trim().toUpperCase() !== "EXCLUIR"}
            style={{
              width: "100%",
              marginTop: 14,
              minHeight: 46,
              border: "none",
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 700,
              fontFamily: "inherit",
              color: "#fff",
              background:
                confirmaTexto.trim().toUpperCase() === "EXCLUIR" && !excluindo
                  ? VERMELHO
                  : "#D8D2E6",
              cursor: excluindo ? "wait" : "pointer",
            }}
          >
            {excluindo ? "Excluindo..." : "Excluir definitivamente"}
          </button>
        </Modal>
      )}

      {/* Re-aceite de versão nova do termo */}
      {portalQ.data?.precisaAceite && (
        <ModalTermo
          titulo="Atualizamos nosso termo de uso"
          onAceitar={aceitarTermo}
          aceitando={aceitando}
          erro={erroAceite}
        />
      )}

      {/* Modal de vínculo (4 últimos dígitos do celular) */}
      {reivAberta && (
        <Modal onClose={() => setReivAberta(null)}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 10 }}>
            <Link2 size={19} color={ROXO} />
            <h2 className="h" style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>
              Vincular candidatura
            </h2>
          </div>
          <p style={{ color: CINZA, fontSize: 13.5, lineHeight: 1.55, margin: "0 0 14px" }}>
            Para confirmar que a candidatura à vaga{" "}
            <strong>{reivAberta.vaga_titulo || "selecionada"}</strong> é sua, digite os{" "}
            <strong>4 últimos dígitos do celular</strong> que você informou na inscrição.
          </p>
          <input
            style={{
              ...inputStyle,
              textAlign: "center",
              fontSize: 22,
              letterSpacing: 8,
              fontWeight: 700,
            }}
            inputMode="numeric"
            autoComplete="off"
            maxLength={4}
            placeholder="0000"
            value={digitos}
            onChange={(e) => setDigitos(e.target.value.replace(/\D/g, "").slice(0, 4))}
          />
          {erroVinculo && (
            <div
              style={{
                fontSize: 12.5,
                color: "#B91C1C",
                background: "#FEF2F2",
                border: "1px solid #FECACA",
                borderRadius: 10,
                padding: 10,
                marginTop: 12,
              }}
            >
              {erroVinculo}
            </div>
          )}
          <button
            onClick={vincular}
            disabled={digitos.length !== 4 || vinculando}
            style={{
              ...btnPrimario(digitos.length === 4 && !vinculando),
              width: "100%",
              marginTop: 14,
            }}
          >
            {vinculando ? <Loader2 size={16} className="spin" /> : <CheckCircle2 size={16} />}{" "}
            Vincular candidatura
          </button>
        </Modal>
      )}
    </Pagina>
  );
}

function fmtDataHora(iso?: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}
