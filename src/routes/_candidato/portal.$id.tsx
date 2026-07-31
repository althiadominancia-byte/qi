import { createFileRoute, notFound, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Calendar,
  CheckCircle2,
  ChevronLeft,
  Download,
  FileText,
  ListChecks,
  Loader2,
  MapPin,
  Phone,
  Save,
  Sparkles,
  Upload,
  UserRound,
  Video,
} from "lucide-react";
import { MarcaEstrela } from "@/components/MarcaEstrela";
import { BrandingStyle, logoUrl } from "@/components/BrandingStyle";
import { PassaporteCandidato } from "@/components/PassaporteCandidato";
import { VideoPitchGravador } from "@/components/VideoPitchGravador";
import { AvaliacoesPendentes } from "@/components/AvaliacoesPendentes";
import {
  getMinhaCandidatura,
  atualizarMeusDados,
  urlMeuCurriculo,
  atualizarMeuCurriculo,
  aplicarPerfilNaCandidatura,
} from "@/lib/portal-candidato.functions";
import { analisarCv } from "@/lib/recrutamento.functions";
import { prepararCv } from "@/lib/recrutamento/cv-upload";
import { supabase } from "@/integrations/supabase/client";
import {
  PERFIS,
  ROXO,
  ROXO_DARK,
  ROXO_TINT,
  LARANJA,
  CINZA,
  BORDA,
  VERDE,
  AMARELO,
} from "@/lib/recrutamento/data";

// /portal/$id — detalhe de UMA candidatura do titular: status, entrevista,
// dados de contato, passaporte de talentos e currículo.
// O guard de sessão fica no layout pai (_candidato/route.tsx).
export const Route = createFileRoute("/_candidato/portal/$id")({
  ssr: false,
  head: () => ({ meta: [{ title: "Minha candidatura — Portal do Candidato" }] }),
  component: CandidaturaPage,
});

const ETAPAS_TIMELINE = ["Em análise", "Entrevista", "Contratado", "Processo encerrado"];
const DESCRICAO_ETAPA: Record<string, string> = {
  "Em análise": "Sua inscrição foi recebida e está sendo avaliada.",
  Entrevista: "Você está na fase de entrevista.",
  Contratado: "Parabéns! Você foi selecionado(a).",
  "Processo encerrado": "Este processo seletivo foi finalizado.",
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
function TituloSecao({ icon: Icon, children }: any) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          background: ROXO_TINT,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon size={17} color={ROXO} />
      </div>
      <h2 className="h" style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>
        {children}
      </h2>
    </div>
  );
}
function Campo({ icon: Icon, label, children, obrig }: any) {
  return (
    <label style={{ display: "block", marginBottom: 14 }}>
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 13,
          fontWeight: 600,
          color: ROXO_DARK,
          marginBottom: 7,
        }}
      >
        {Icon && <Icon size={15} color={ROXO} />} {label}{" "}
        {obrig && <span style={{ color: LARANJA }}>*</span>}
      </span>
      {children}
    </label>
  );
}

function fmtData(iso?: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "";
  }
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

function CandidaturaPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchCand = useServerFn(getMinhaCandidatura);
  const salvarDados = useServerFn(atualizarMeusDados);
  const gerarUrlCv = useServerFn(urlMeuCurriculo);
  const aplicarPerfil = useServerFn(aplicarPerfilNaCandidatura);
  const salvarCv = useServerFn(atualizarMeuCurriculo);
  const analisarCvFn = useServerFn(analisarCv);

  const candQ = useQuery({
    queryKey: ["minha-candidatura", id],
    queryFn: () => fetchCand({ data: { candidatoId: id } }) as Promise<any>,
    retry: false,
  });

  // Formulário "Meus dados"
  const [nome, setNome] = useState("");
  const [celular, setCelular] = useState("");
  const [endereco, setEndereco] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [msgDados, setMsgDados] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  // Aplicar perfil neutro nesta candidatura
  const [aplicandoPerfil, setAplicandoPerfil] = useState(false);
  const [msgPerfil, setMsgPerfil] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  // Currículo
  const [baixandoCv, setBaixandoCv] = useState(false);
  const [erroCv, setErroCv] = useState("");
  const [enviandoCv, setEnviandoCv] = useState(false);
  const [msgCv, setMsgCv] = useState("");
  const cvInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const dd = candQ.data?.dados;
    if (dd) {
      setNome(dd.nome ?? "");
      setCelular(dd.celular ?? "");
      setEndereco(dd.endereco ?? "");
    }
  }, [candQ.data]);

  if (candQ.isLoading) {
    return (
      <div
        style={{
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
          minHeight: "60vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: CINZA,
          fontSize: 14,
          gap: 8,
        }}
      >
        <style>{`@keyframes spin{to{transform:rotate(360deg)}} .spin{animation:spin 1s linear infinite}`}</style>
        <Loader2 size={20} className="spin" /> Carregando candidatura...
      </div>
    );
  }
  // Erro (candidatura de outra conta, id inválido, portal desativado) ⇒ 404 do root.
  if (candQ.isError || !candQ.data) throw notFound();

  const d = candQ.data;
  const empresa = d.empresa;
  const logo = logoUrl(empresa?.logo_path ?? null);
  const etapa: string = d.etapa_mapeada || "Em análise";
  const etapaIdx = ETAPAS_TIMELINE.indexOf(etapa);
  const entrevista = d.entrevista;

  async function onSalvarDados() {
    if (salvando) return;
    setSalvando(true);
    setMsgDados(null);
    try {
      await salvarDados({
        data: {
          candidatoId: id,
          nome: nome.trim(),
          celular: celular.trim(),
          endereco: endereco.trim() || null,
        },
      });
      setMsgDados({ tipo: "ok", texto: "Dados atualizados com sucesso." });
      await qc.invalidateQueries({ queryKey: ["minha-candidatura", id] });
    } catch (e: any) {
      setMsgDados({ tipo: "erro", texto: e?.message || "Não foi possível salvar seus dados." });
    } finally {
      setSalvando(false);
    }
  }

  async function onBaixarCv() {
    if (baixandoCv) return;
    setBaixandoCv(true);
    setErroCv("");
    try {
      const { url } = (await gerarUrlCv({ data: { candidatoId: id } })) as { url: string };
      window.open(url, "_blank", "noopener");
    } catch (e: any) {
      setErroCv(
        /Currículo não encontrado/i.test(String(e?.message))
          ? "Você não anexou currículo nesta candidatura."
          : e?.message || "Não foi possível gerar o link do currículo.",
      );
    } finally {
      setBaixandoCv(false);
    }
  }

  async function onAtualizarCv(file: File) {
    if (enviandoCv) return;
    setEnviandoCv(true);
    setErroCv("");
    setMsgCv("");
    try {
      const upload = d.cv?.upload;
      if (!upload?.empresa_id || !upload?.vaga_id) {
        throw new Error("Esta candidatura não permite atualizar o currículo.");
      }
      const prep = await prepararCv(file);
      const arquivo = prep.arquivo;
      const ext = arquivo.name.split(".").pop() ?? "bin";
      // Mesma convenção de path do funil público: <empresa>/<vaga>/<arquivo>.
      const storagePath = `${upload.empresa_id}/${upload.vaga_id}/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("curriculos")
        .upload(storagePath, arquivo, { contentType: arquivo.type || undefined });
      if (upErr) throw new Error(upErr.message);
      await salvarCv({ data: { candidatoId: id, storagePath, nomeArquivo: file.name } });
      // Reanálise em segundo plano — não bloqueia nem quebra o fluxo do titular.
      analisarCvFn({
        data: { candidatoId: id, storagePath, mimeType: arquivo.type },
      }).catch((e) => console.warn("Reanálise do currículo falhou:", e));
      setMsgCv("Currículo atualizado — a empresa foi informada.");
      await qc.invalidateQueries({ queryKey: ["minha-candidatura", id] });
    } catch (e: any) {
      setErroCv(e?.message || "Não foi possível atualizar seu currículo.");
    } finally {
      setEnviandoCv(false);
      if (cvInputRef.current) cvInputRef.current.value = "";
    }
  }

  const perfilInfo = d.perfil?.key ? (PERFIS as any)[d.perfil.key] : null;
  const avaliacoesPendentes =
    d.avaliacoes?.disc_pendente || d.avaliacoes?.situacional_pendente || false;

  return (
    // Conteúdo da página (header/rodapé do portal vêm do layout _candidato/route.tsx).
    <div
      style={{
        background: `radial-gradient(120% 80% at 50% -10%, ${ROXO_TINT} 0%, #FBFAFE 45%, #FFFFFF 100%)`,
        minHeight: "100%",
        color: ROXO_DARK,
        padding: "0 0 48px",
      }}
    >
      <style>{`*{box-sizing:border-box} html,body{overflow-x:hidden;max-width:100vw}
        input:focus,select:focus,textarea:focus{border-color:${ROXO}!important}
        @keyframes spin{to{transform:rotate(360deg)}} .spin{animation:spin 1s linear infinite}
        @media (max-width:640px){
          input,select,textarea{font-size:16px !important}
          [data-pad]{padding:0 12px !important}
          [data-card]{padding:16px !important;border-radius:14px !important}
          [data-grid]{grid-template-columns:1fr !important}
        }
      `}</style>

      {/* Faixa com a marca da EMPRESA da candidatura (white-label). O BrandingStyle
          recolore as vars --brand-* da página inteira, inclusive o header do layout. */}
      <div
        style={{
          background: ROXO,
          padding: "14px 18px",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        {empresa && (
          <BrandingStyle
            cor_primaria={empresa.cor_primaria}
            cor_sidebar={empresa.cor_sidebar}
            cor_botao={empresa.cor_botao}
          />
        )}
        <MarcaEstrela size={34} branca src={logo} alt={empresa?.nome || "Distribuidora Estrela"} />
        {empresa?.nome ? (
          <div
            className="h"
            style={{
              color: "#fff",
              fontWeight: 800,
              fontSize: 19,
              letterSpacing: 0.5,
              lineHeight: 1.1,
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {empresa.nome}
          </div>
        ) : (
          <div style={{ lineHeight: 1 }}>
            <div
              className="h"
              style={{
                color: "#fff",
                fontWeight: 700,
                letterSpacing: 2,
                fontSize: 11,
                opacity: 0.85,
              }}
            >
              DISTRIBUIDORA
            </div>
            <div
              className="h"
              style={{ color: "#fff", fontWeight: 800, fontSize: 19, letterSpacing: 1 }}
            >
              ESTRELA
            </div>
          </div>
        )}
        <div
          style={{
            marginLeft: "auto",
            color: "#fff",
            fontSize: 12,
            opacity: 0.8,
            whiteSpace: "nowrap",
          }}
        >
          Minha candidatura
        </div>
      </div>

      <div data-pad style={{ maxWidth: 720, margin: "0 auto", padding: "0 18px" }}>
        <button
          onClick={() => navigate({ to: "/portal" as any })}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            background: "none",
            border: "none",
            color: CINZA,
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: 13.5,
            margin: "16px 0 14px",
            padding: "6px 4px",
          }}
        >
          <ChevronLeft size={16} /> Minhas candidaturas
        </button>

        {/* 1. Status */}
        <Card>
          <TituloSecao icon={CheckCircle2}>Status da candidatura</TituloSecao>
          <div style={{ display: "grid", gap: 0 }}>
            {ETAPAS_TIMELINE.map((e, i) => {
              const atual = e === etapa;
              // "Contratado" e "Processo encerrado" são finais alternativos: um
              // processo encerrado não passou por "Contratado".
              const feita = i < etapaIdx && e !== "Contratado";
              const cor = atual
                ? e === "Contratado"
                  ? VERDE
                  : e === "Processo encerrado"
                    ? CINZA
                    : ROXO
                : feita
                  ? VERDE
                  : "#C9C3D8";
              const ultima = i === ETAPAS_TIMELINE.length - 1;
              return (
                <div key={e} style={{ display: "flex", gap: 12 }}>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      width: 22,
                    }}
                  >
                    <div
                      style={{
                        width: atual ? 18 : 12,
                        height: atual ? 18 : 12,
                        borderRadius: 99,
                        background: atual || feita ? cor : "#fff",
                        border: `2.5px solid ${cor}`,
                        marginTop: 3,
                        flexShrink: 0,
                      }}
                    />
                    {!ultima && (
                      <div
                        style={{
                          width: 2,
                          flex: 1,
                          minHeight: 18,
                          background: feita ? VERDE : BORDA,
                        }}
                      />
                    )}
                  </div>
                  <div style={{ paddingBottom: ultima ? 0 : 14 }}>
                    <div
                      style={{
                        fontSize: atual ? 15 : 13.5,
                        fontWeight: atual ? 800 : 600,
                        color: atual ? ROXO_DARK : feita ? ROXO_DARK : "#9b93b0",
                      }}
                      className={atual ? "h" : undefined}
                    >
                      {e}
                    </div>
                    {atual && (
                      <div style={{ fontSize: 12.5, color: CINZA, marginTop: 2, lineHeight: 1.5 }}>
                        {DESCRICAO_ETAPA[e]}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* 1b. Perfil comportamental (só o rótulo — nunca pontuações) */}
        {perfilInfo && (
          <Card>
            <TituloSecao icon={Sparkles}>Seu perfil comportamental</TituloSecao>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span className="h" style={{ fontSize: 18, fontWeight: 800, color: ROXO_DARK }}>
                {perfilInfo.nome}
              </span>
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 700,
                  color: ROXO,
                  background: ROXO_TINT,
                  padding: "4px 11px",
                  borderRadius: 99,
                }}
              >
                {perfilInfo.tag}
              </span>
            </div>
            <p style={{ fontSize: 13.5, color: CINZA, lineHeight: 1.6, margin: "10px 0 12px" }}>
              {perfilInfo.plain}
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
              {(perfilInfo.forcas as string[]).map((f) => (
                <span
                  key={f}
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: ROXO_DARK,
                    background: ROXO_TINT,
                    border: `1px solid ${BORDA}`,
                    padding: "5px 12px",
                    borderRadius: 99,
                  }}
                >
                  {f}
                </span>
              ))}
            </div>
          </Card>
        )}

        {/* 1c. Avaliações pendentes (DISC/situacional que faltaram na inscrição) */}
        {avaliacoesPendentes && (
          <Card>
            <TituloSecao icon={ListChecks}>Complete seu perfil</TituloSecao>
            <p style={{ fontSize: 13, color: CINZA, lineHeight: 1.55, margin: "0 0 16px" }}>
              Falta pouco! Responda as perguntas abaixo para a empresa conhecer melhor o seu jeito
              de trabalhar. Não tem resposta certa ou errada.
            </p>
            <AvaliacoesPendentes
              candidatoId={id}
              config={d.avaliacoes?.config ?? null}
              discPendente={!!d.avaliacoes?.disc_pendente}
              sitPendente={!!d.avaliacoes?.situacional_pendente}
              onConcluido={() => qc.invalidateQueries({ queryKey: ["minha-candidatura", id] })}
            />
          </Card>
        )}

        {/* 2. Entrevista */}
        {entrevista && (
          <Card>
            <TituloSecao icon={Video}>Entrevista</TituloSecao>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                flexWrap: "wrap",
                marginBottom: entrevista.link_token ? 14 : 0,
              }}
            >
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: LARANJA,
                  background: `color-mix(in srgb, ${LARANJA} 12%, white)`,
                  padding: "4px 11px",
                  borderRadius: 99,
                }}
              >
                {entrevista.status_rotulo}
              </span>
              {entrevista.agendada_para && (
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    fontSize: 13.5,
                    fontWeight: 600,
                    color: ROXO_DARK,
                  }}
                >
                  <Calendar size={14} color={ROXO} /> {fmtDataHora(entrevista.agendada_para)}
                </span>
              )}
            </div>
            {entrevista.link_token && (
              <a
                href={`/e/${entrevista.link_token}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  background: ROXO,
                  color: "#fff",
                  textDecoration: "none",
                  padding: "12px 20px",
                  borderRadius: 12,
                  fontSize: 14,
                  fontWeight: 700,
                  minHeight: 46,
                  boxSizing: "border-box",
                }}
              >
                <Video size={16} /> Entrar na entrevista
              </a>
            )}
          </Card>
        )}

        {/* 3. Meus dados */}
        <Card>
          <TituloSecao icon={UserRound}>Meus dados</TituloSecao>
          <Campo icon={UserRound} label="Nome completo" obrig>
            <input
              style={inputStyle}
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Seu nome"
            />
          </Campo>
          <div data-grid style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <Campo icon={Phone} label="Celular / WhatsApp" obrig>
              <input
                style={inputStyle}
                value={celular}
                onChange={(e) => setCelular(e.target.value)}
                placeholder="(96) 9 9999-9999"
              />
            </Campo>
            <Campo label="E-mail">
              <input
                style={{ ...inputStyle, background: "#F4F3F6", color: CINZA }}
                value={d.dados?.email ?? ""}
                readOnly
              />
              <span style={{ fontSize: 11.5, color: "#9b93b0", display: "block", marginTop: 5 }}>
                O e-mail identifica sua conta e não pode ser alterado.
              </span>
            </Campo>
          </div>
          <Campo icon={MapPin} label="Endereço (bairro e cidade)">
            <input
              style={inputStyle}
              value={endereco}
              onChange={(e) => setEndereco(e.target.value)}
              placeholder="Bairro, Cidade - UF"
            />
          </Campo>
          {msgDados && (
            <div
              style={{
                fontSize: 12.5,
                borderRadius: 10,
                padding: 10,
                marginBottom: 12,
                color: msgDados.tipo === "ok" ? VERDE : "#B91C1C",
                background: msgDados.tipo === "ok" ? "#F0FDF4" : "#FEF2F2",
                border: `1px solid ${msgDados.tipo === "ok" ? "#BBF7D0" : "#FECACA"}`,
              }}
            >
              {msgDados.texto}
            </div>
          )}
          <button
            onClick={onSalvarDados}
            disabled={salvando || !nome.trim() || celular.trim().length < 8}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              background: salvando || !nome.trim() || celular.trim().length < 8 ? "#D8D2E6" : ROXO,
              color: "#fff",
              border: "none",
              padding: "12px 20px",
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 700,
              cursor: salvando ? "wait" : "pointer",
              fontFamily: "inherit",
              minHeight: 46,
            }}
          >
            {salvando ? <Loader2 size={15} className="spin" /> : <Save size={15} />} Salvar meus
            dados
          </button>
        </Card>

        {/* 4. Passaporte de talentos */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            flexWrap: "wrap",
            gap: 10,
            margin: "0 0 10px",
          }}
        >
          <button
            onClick={async () => {
              if (aplicandoPerfil) return;
              setAplicandoPerfil(true);
              setMsgPerfil(null);
              try {
                await aplicarPerfil({ data: { candidatoId: id } });
                setMsgPerfil({ tipo: "ok", texto: "Perfil aplicado!" });
                await qc.invalidateQueries({ queryKey: ["minha-candidatura", id] });
              } catch (e: any) {
                setMsgPerfil({ tipo: "erro", texto: e?.message || "Não foi possível aplicar." });
              } finally {
                setAplicandoPerfil(false);
              }
            }}
            disabled={aplicandoPerfil}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              background: "#fff",
              color: ROXO,
              border: `1.5px solid ${BORDA}`,
              padding: "9px 14px",
              borderRadius: 11,
              fontSize: 12.5,
              fontWeight: 700,
              cursor: aplicandoPerfil ? "wait" : "pointer",
              fontFamily: "inherit",
            }}
          >
            {aplicandoPerfil ? <Loader2 size={14} className="spin" /> : <UserRound size={14} />}{" "}
            Aplicar meu perfil nesta candidatura
          </button>
          <button
            onClick={() => navigate({ to: "/portal/perfil" as any })}
            style={{
              background: "none",
              border: "none",
              color: CINZA,
              fontSize: 12,
              cursor: "pointer",
              fontFamily: "inherit",
              textDecoration: "underline",
            }}
          >
            editar meu perfil →
          </button>
          {msgPerfil && (
            <span
              style={{
                fontSize: 12.5,
                fontWeight: 700,
                color: msgPerfil.tipo === "ok" ? VERDE : "#B91C1C",
              }}
            >
              {msgPerfil.texto}
            </span>
          )}
        </div>
        <PassaporteCandidato
          candidatoId={id}
          passaporte={d.passaporte}
          empresaId={(d as any).empresa_id ?? null}
        />

        {/* 5. Currículo */}
        <Card>
          <TituloSecao icon={FileText}>Currículo</TituloSecao>
          <p style={{ fontSize: 13, color: CINZA, lineHeight: 1.55, margin: "0 0 12px" }}>
            Baixe o currículo que você enviou nesta candidatura
            {d.cv?.atualizavel ? " ou envie uma versão mais nova." : "."}
          </p>
          {d.cv?.nome_arquivo && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                fontSize: 13,
                fontWeight: 600,
                color: ROXO_DARK,
                background: ROXO_TINT,
                border: `1px solid ${BORDA}`,
                borderRadius: 10,
                padding: "9px 12px",
                marginBottom: 12,
                wordBreak: "break-all",
              }}
            >
              <FileText size={15} color={ROXO} style={{ flexShrink: 0 }} /> {d.cv.nome_arquivo}
            </div>
          )}
          {erroCv && (
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
              {erroCv}
            </div>
          )}
          {msgCv && (
            <div
              style={{
                fontSize: 12.5,
                color: VERDE,
                background: "#F0FDF4",
                border: "1px solid #BBF7D0",
                borderRadius: 10,
                padding: 10,
                marginBottom: 12,
              }}
            >
              {msgCv}
            </div>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            <button
              onClick={onBaixarCv}
              disabled={baixandoCv}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                background: "#fff",
                color: ROXO,
                border: `1.5px solid ${BORDA}`,
                padding: "11px 18px",
                borderRadius: 12,
                fontSize: 14,
                fontWeight: 700,
                cursor: baixandoCv ? "wait" : "pointer",
                fontFamily: "inherit",
                minHeight: 46,
              }}
            >
              {baixandoCv ? <Loader2 size={15} className="spin" /> : <Download size={15} />} Baixar
              meu currículo
            </button>
            {d.cv?.atualizavel && (
              <>
                <input
                  ref={cvInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp,.heic,.heif,application/pdf,image/*"
                  style={{ display: "none" }}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onAtualizarCv(f);
                  }}
                />
                <button
                  onClick={() => cvInputRef.current?.click()}
                  disabled={enviandoCv}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    background: "#fff",
                    color: ROXO,
                    border: `1.5px solid ${BORDA}`,
                    padding: "11px 18px",
                    borderRadius: 12,
                    fontSize: 14,
                    fontWeight: 700,
                    cursor: enviandoCv ? "wait" : "pointer",
                    fontFamily: "inherit",
                    minHeight: 46,
                  }}
                >
                  {enviandoCv ? <Loader2 size={15} className="spin" /> : <Upload size={15} />}{" "}
                  Atualizar currículo
                </button>
              </>
            )}
          </div>
          {!d.cv?.atualizavel && d.cv?.tem_arquivo && (
            <p style={{ fontSize: 12, color: "#9b93b0", margin: "12px 0 0", lineHeight: 1.5 }}>
              Esta vaga não recebe mais currículos novos.
            </p>
          )}
        </Card>

        {/* 6. Vídeo de apresentação (só com o entitlement video_pitch da empresa) */}
        {(d as any).video?.habilitado && (
          <Card>
            <TituloSecao icon={Video}>Vídeo de apresentação</TituloSecao>
            <VideoPitchGravador
              candidatoId={id}
              empresaId={(d as any).empresa_id ?? null}
              video={(d as any).video}
              onMudou={() => qc.invalidateQueries({ queryKey: ["minha-candidatura", id] })}
            />
          </Card>
        )}
      </div>
    </div>
  );
}
