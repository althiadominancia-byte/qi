import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Save,
  Loader2,
  Star,
  Briefcase,
  GraduationCap,
  Heart,
  User,
  FileText,
  Upload,
  Download,
  X,
  Plus,
  CheckCircle2,
} from "lucide-react";
import {
  getMeuPerfil,
  salvarRespostasPerfil,
  estruturarMeuPerfil,
  salvarMinhaCompetenciaConta,
  removerMinhaCompetenciaConta,
  salvarExperienciaConta,
  removerExperienciaConta,
  salvarPreferenciasConta,
  salvarMeusDadosConta,
  salvarFormacaoConta,
  removerFormacaoConta,
  enviarMeuCurriculoConta,
  urlMeuCurriculoConta,
  gerarMeuCurriculo,
  setMinhaVisibilidadePool,
} from "@/lib/portal-candidato.functions";
import { supabase } from "@/integrations/supabase/client";
import { ROXO, ROXO_DARK, ROXO_TINT, LARANJA, CINZA, BORDA, VERDE } from "@/lib/recrutamento/data";

// /portal/perfil — Cadastro Neutro em FLUXO DE ETAPAS (diretriz do dono):
// começa pelo currículo (quem tem, sobe e as etapas nascem preenchidas; quem
// não tem vai digitando passo a passo). Uma coisa de cada vez, nunca tudo
// numa página só.

export const Route = createFileRoute("/_candidato/portal/perfil")({
  head: () => ({ meta: [{ title: "Meu perfil — Portal do Candidato" }] }),
  component: MeuPerfilPage,
});

type Etapa =
  | "curriculo"
  | "dados"
  | "historia"
  | "formacao"
  | "experiencias"
  | "habilidades"
  | "preferencias"
  | "fim";
const ETAPAS: { key: Etapa; rotulo: string }[] = [
  { key: "curriculo", rotulo: "Currículo" },
  { key: "dados", rotulo: "Seus dados" },
  { key: "historia", rotulo: "Sua história" },
  { key: "formacao", rotulo: "Formação" },
  { key: "experiencias", rotulo: "Experiências" },
  { key: "habilidades", rotulo: "Habilidades" },
  { key: "preferencias", rotulo: "Preferências" },
  { key: "fim", rotulo: "Pronto!" },
];

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
      style={{
        background: "#fff",
        borderRadius: 16,
        padding: 20,
        border: `1px solid ${BORDA}`,
        marginBottom: 14,
      }}
    >
      {children}
    </div>
  );
}

function TituloEtapa({ icon: Icon, children, sub }: any) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: ROXO_TINT,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Icon size={18} color={ROXO} />
        </div>
        <h2 className="h" style={{ fontSize: 19, fontWeight: 800, margin: 0, color: ROXO_DARK }}>
          {children}
        </h2>
      </div>
      {sub && (
        <p style={{ fontSize: 13, color: CINZA, margin: "8px 0 0", lineHeight: 1.55 }}>{sub}</p>
      )}
    </div>
  );
}

const PERGUNTAS: { chave: string; label: string; placeholder: string }[] = [
  {
    chave: "sei_fazer",
    label: "O que você sabe fazer bem?",
    placeholder:
      "Pode falar do dia a dia mesmo: atender gente, organizar coisas, vender, cuidar...",
  },
  {
    chave: "historia_trabalho",
    label: "Onde você já trabalhou ou estudou?",
    placeholder:
      "Vale tudo: emprego com carteira, bico, trabalho informal, projeto, igreja, voluntariado, cursos...",
  },
  {
    chave: "interesses",
    label: "O que você gostaria de fazer?",
    placeholder: "Áreas, tipos de trabalho ou sonhos profissionais...",
  },
  {
    chave: "preferencias_texto",
    label: "Como você prefere trabalhar?",
    placeholder: "Horários, ambiente, ritmo, perto de casa...",
  },
];

const TIPOS_EXP: Record<string, string> = {
  formal: "Com carteira / formal",
  informal: "Informal / bico",
  voluntariado: "Voluntariado",
  projeto: "Projeto",
  curso: "Curso",
};

const SELO_VALIDACAO: Record<string, { rotulo: string; cor: string; fundo: string }> = {
  consistente_cv: { rotulo: "✓ Confere com o currículo", cor: VERDE, fundo: "#F0FDF4" },
  pendente_confirmacao: { rotulo: "Pendente", cor: LARANJA, fundo: "#FFF7ED" },
  declarada: { rotulo: "Declarada", cor: CINZA, fundo: "#F4F4F5" },
};

const STATUS_FORM: Record<string, string> = {
  concluido: "Concluído",
  cursando: "Cursando",
  incompleto: "Incompleto",
};

// Preferências por SELEÇÃO (pedido do dono: clicar é mais prático que digitar).
const DISPONIBILIDADES = [
  "Manhã",
  "Tarde",
  "Noite",
  "Madrugada",
  "Fins de semana",
  "Escala / turnos",
  "Qualquer horário",
];
const INTERESSES_SUGERIDOS = [
  "Vendas",
  "Atendimento",
  "Administrativo",
  "Estoque / logística",
  "Produção",
  "Serviços gerais",
  "Cozinha / alimentação",
  "Motorista / entregas",
  "Beleza / estética",
  "Saúde / cuidado",
  "Educação",
  "Tecnologia",
];

function chipStyle(on: boolean): React.CSSProperties {
  return {
    padding: "8px 14px",
    borderRadius: 99,
    fontSize: 12.5,
    fontWeight: on ? 700 : 500,
    cursor: "pointer",
    fontFamily: "inherit",
    border: `1.5px solid ${on ? ROXO : BORDA}`,
    background: on ? ROXO_TINT : "#fff",
    color: on ? ROXO_DARK : CINZA,
  };
}

function MeuPerfilPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchPerfil = useServerFn(getMeuPerfil);
  const salvarResp = useServerFn(salvarRespostasPerfil);
  const estruturar = useServerFn(estruturarMeuPerfil);
  const salvarComp = useServerFn(salvarMinhaCompetenciaConta);
  const removerComp = useServerFn(removerMinhaCompetenciaConta);
  const salvarExp = useServerFn(salvarExperienciaConta);
  const removerExp = useServerFn(removerExperienciaConta);
  const salvarPrefsFn = useServerFn(salvarPreferenciasConta);
  const salvarDadosFn = useServerFn(salvarMeusDadosConta);
  const salvarForm = useServerFn(salvarFormacaoConta);
  const removerForm = useServerFn(removerFormacaoConta);
  const enviarCv = useServerFn(enviarMeuCurriculoConta);
  const urlCv = useServerFn(urlMeuCurriculoConta);
  const gerarCv = useServerFn(gerarMeuCurriculo);
  const setVisibilidade = useServerFn(setMinhaVisibilidadePool);

  const perfilQ = useQuery({
    queryKey: ["meu-perfil"],
    queryFn: () => fetchPerfil() as Promise<any>,
    retry: false,
  });
  const d = perfilQ.data;

  const [etapa, setEtapa] = useState<Etapa>("curriculo");
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [ocupadoTexto, setOcupadoTexto] = useState("");

  // Estados por etapa
  const [dados, setDados] = useState({ nome: "", celular: "", endereco: "" });
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [formAberta, setFormAberta] = useState(false);
  const [formEdit, setFormEdit] = useState<any>({
    titulo: "",
    instituicao: "",
    ano: "",
    status: "concluido",
  });
  const [expAberta, setExpAberta] = useState(false);
  const [expEdit, setExpEdit] = useState<any>({
    tipo: "formal",
    titulo: "",
    organizacao: "",
    descricao: "",
  });
  const [prefs, setPrefs] = useState<any>({
    disponibilidade: "",
    pretensao_min: "",
    pretensao_max: "",
    modelo_trabalho: null,
    interesses: [],
  });
  const [novoInteresse, setNovoInteresse] = useState("");

  useEffect(() => {
    if (!d) return;
    setDados({
      nome: d.dados?.nome ?? "",
      celular: d.dados?.celular ?? "",
      endereco: d.dados?.endereco ?? "",
    });
    setRespostas({ ...(d.respostas ?? {}) });
    if (d.preferencias) {
      setPrefs({
        disponibilidade: d.preferencias.disponibilidade ?? "",
        pretensao_min: d.preferencias.pretensao_min ?? "",
        pretensao_max: d.preferencias.pretensao_max ?? "",
        modelo_trabalho: d.preferencias.modelo_trabalho ?? null,
        interesses: Array.isArray(d.preferencias.interesses) ? d.preferencias.interesses : [],
      });
    }
  }, [d]);

  const invalidar = () => qc.invalidateQueries({ queryKey: ["meu-perfil"] });
  const idx = ETAPAS.findIndex((e) => e.key === etapa);
  const irPara = (delta: number) => {
    setMsg(null);
    setEtapa(ETAPAS[Math.min(ETAPAS.length - 1, Math.max(0, idx + delta))].key);
    window.scrollTo({ top: 0 });
  };

  // ---------- Ações ----------
  async function onEnviarCvConta(file: File) {
    setOcupado(true);
    setOcupadoTexto("Lendo seu currículo e preenchendo tudo...");
    setMsg(null);
    try {
      const ext = (file.name.split(".").pop() || "pdf").toLowerCase();
      if (!["pdf", "jpg", "jpeg", "png", "webp", "docx"].includes(ext)) {
        throw new Error("Envie PDF, imagem (JPG/PNG/WEBP) ou DOCX.");
      }
      if (file.size > 8 * 1024 * 1024) throw new Error("Arquivo grande demais (limite 8 MB).");
      const { data: u } = await supabase.auth.getUser();
      if (!u?.user?.id) throw new Error("Sessão expirada — entre de novo.");
      const path = `conta/${u.user.id}/cv-${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("curriculos")
        .upload(path, file, { contentType: file.type || undefined });
      if (upErr) throw new Error("Falha no envio: " + upErr.message);
      await enviarCv({ data: { storagePath: path, nomeArquivo: file.name } as any });
      await estruturar();
      await invalidar();
      setMsg({
        tipo: "ok",
        texto: "Preenchemos as próximas etapas com o seu currículo — confira e ajuste!",
      });
      setEtapa("dados");
      window.scrollTo({ top: 0 });
    } catch (e: any) {
      setMsg({ tipo: "erro", texto: e?.message || "Não foi possível ler o currículo." });
    } finally {
      setOcupado(false);
    }
  }

  async function continuarDados() {
    if (!dados.nome.trim()) {
      setMsg({ tipo: "erro", texto: "Informe pelo menos o seu nome." });
      return;
    }
    setOcupado(true);
    setOcupadoTexto("Salvando...");
    try {
      await salvarDadosFn({
        data: {
          nome: dados.nome.trim(),
          celular: dados.celular || null,
          endereco: dados.endereco || null,
        } as any,
      });
      await invalidar();
      irPara(1);
    } catch (e: any) {
      setMsg({ tipo: "erro", texto: e?.message || "Não foi possível salvar." });
    } finally {
      setOcupado(false);
    }
  }

  async function continuarHistoria() {
    setOcupado(true);
    const temTexto = Object.values(respostas).some((v) => String(v ?? "").trim());
    const jaEstruturado = !!d?.estruturado_em;
    setOcupadoTexto(
      temTexto && !jaEstruturado ? "Organizando seu perfil com IA..." : "Salvando...",
    );
    try {
      await salvarResp({ data: { respostas } as any });
      // Sem CV e com respostas: estrutura agora para as PRÓXIMAS etapas
      // (formação, experiências, habilidades) já virem preenchidas.
      if (temTexto && !jaEstruturado) {
        await estruturar().catch(() => {});
      }
      await invalidar();
      irPara(1);
    } catch (e: any) {
      setMsg({ tipo: "erro", texto: e?.message || "Não foi possível salvar." });
    } finally {
      setOcupado(false);
    }
  }

  async function continuarPreferencias() {
    setOcupado(true);
    setOcupadoTexto("Salvando...");
    try {
      await salvarPrefsFn({
        data: {
          disponibilidade: prefs.disponibilidade || null,
          pretensao_min: prefs.pretensao_min === "" ? null : Number(prefs.pretensao_min),
          pretensao_max: prefs.pretensao_max === "" ? null : Number(prefs.pretensao_max),
          modelo_trabalho: prefs.modelo_trabalho,
          interesses: prefs.interesses,
        } as any,
      });
      await invalidar();
      irPara(1);
    } catch (e: any) {
      setMsg({ tipo: "erro", texto: e?.message || "Não foi possível salvar." });
    } finally {
      setOcupado(false);
    }
  }

  async function verMeuCurriculo() {
    setOcupado(true);
    setOcupadoTexto("Montando seu currículo...");
    try {
      await gerarCv();
      navigate({ to: "/portal/curriculo" as any });
    } catch (e: any) {
      setMsg({ tipo: "erro", texto: e?.message || "Não foi possível criar o currículo." });
      setOcupado(false);
    }
  }

  if (perfilQ.isLoading) {
    return (
      <div style={{ padding: 60, textAlign: "center", color: CINZA }}>
        <Loader2 size={22} className="spin" /> Carregando seu perfil...
      </div>
    );
  }

  const botaoPrimario: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    background: ocupado ? "#D8D2E6" : ROXO,
    color: "#fff",
    border: "none",
    padding: "12px 22px",
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 700,
    cursor: ocupado ? "wait" : "pointer",
    fontFamily: "inherit",
    minHeight: 48,
  };
  const botaoSec: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    background: "none",
    border: "none",
    color: CINZA,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
    padding: "0 8px",
    minHeight: 44,
  };

  return (
    <div style={{ maxWidth: 680, margin: "0 auto", padding: "18px 16px 60px" }}>
      <button
        onClick={() => navigate({ to: "/portal" as any })}
        style={{ ...botaoSec, padding: "8px 0" }}
      >
        <ChevronLeft size={16} /> Minhas candidaturas
      </button>

      {/* Barra de progresso */}
      <div style={{ margin: "10px 0 18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: ROXO_DARK }}>
            {ETAPAS[idx].rotulo}
          </span>
          <span style={{ fontSize: 12, color: "#9b93b0" }}>
            {idx + 1} de {ETAPAS.length}
          </span>
        </div>
        <div style={{ height: 6, background: "#EEEAF6", borderRadius: 99 }}>
          <div
            style={{
              height: 6,
              width: `${((idx + 1) / ETAPAS.length) * 100}%`,
              background: LARANJA,
              borderRadius: 99,
              transition: "width .25s",
            }}
          />
        </div>
      </div>

      {msg && (
        <div
          style={{
            fontSize: 13,
            borderRadius: 11,
            padding: 12,
            marginBottom: 14,
            color: msg.tipo === "ok" ? VERDE : "#B91C1C",
            background: msg.tipo === "ok" ? "#F0FDF4" : "#FEF2F2",
            border: `1px solid ${msg.tipo === "ok" ? "#BBF7D0" : "#FECACA"}`,
          }}
        >
          {msg.texto}
        </div>
      )}

      {/* ============ 1. CURRÍCULO ============ */}
      {etapa === "curriculo" && (
        <Card>
          <TituloEtapa
            icon={FileText}
            sub="Se você tem currículo, comece por ele: a gente lê e preenche as próximas etapas pra você. Se não tem, sem problema — vamos montando juntos, passo a passo."
          >
            Você tem currículo?
          </TituloEtapa>
          {d?.cv?.tem_arquivo && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                marginBottom: 12,
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontSize: 13, color: ROXO_DARK, fontWeight: 600 }}>
                📄 {d.cv.nome_arquivo ?? "currículo enviado"}
              </span>
              <button
                onClick={() =>
                  urlCv()
                    .then((r: any) => window.open(r.url, "_blank", "noopener"))
                    .catch(() => {})
                }
                style={{
                  ...botaoSec,
                  color: ROXO,
                  textDecoration: "underline",
                  padding: 0,
                  minHeight: 0,
                }}
              >
                <Download size={13} /> baixar
              </button>
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Com currículo já enviado, o AVANÇAR é o botão principal. */}
            {d?.cv?.tem_arquivo && (
              <button onClick={() => irPara(1)} disabled={ocupado} style={botaoPrimario}>
                Continuar <ChevronRight size={16} />
              </button>
            )}
            <label
              style={{
                ...botaoPrimario,
                cursor: ocupado ? "wait" : "pointer",
                ...(d?.cv?.tem_arquivo
                  ? { background: "#fff", color: ROXO, border: `1.5px solid ${BORDA}` }
                  : {}),
              }}
            >
              {ocupado ? <Loader2 size={16} className="spin" /> : <Upload size={16} />}
              {ocupado
                ? ocupadoTexto
                : d?.cv?.tem_arquivo
                  ? "Enviar outro currículo"
                  : "Sim — enviar meu currículo"}
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.webp,.docx"
                style={{ display: "none" }}
                disabled={ocupado}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onEnviarCvConta(f);
                  e.target.value = "";
                }}
              />
            </label>
            {!d?.cv?.tem_arquivo && (
              <button
                onClick={() => irPara(1)}
                disabled={ocupado}
                style={{
                  ...botaoPrimario,
                  background: "#fff",
                  color: ROXO,
                  border: `1.5px solid ${BORDA}`,
                }}
              >
                Não tenho — vou preenchendo <ChevronRight size={16} />
              </button>
            )}
          </div>
          <p style={{ fontSize: 12, color: "#9b93b0", margin: "12px 0 0", lineHeight: 1.5 }}>
            Quem não tem currículo sai daqui com um: no final a gente cria um pra você, pronto para
            baixar em PDF. 😉
          </p>
        </Card>
      )}

      {/* ============ 2. SEUS DADOS ============ */}
      {etapa === "dados" && (
        <Card>
          <TituloEtapa icon={User} sub="Para as empresas conseguirem falar com você.">
            Seus dados
          </TituloEtapa>
          <label style={{ display: "block", marginBottom: 12 }}>
            <span
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 700,
                color: ROXO_DARK,
                marginBottom: 5,
              }}
            >
              Nome completo *
            </span>
            <input
              style={inputStyle}
              value={dados.nome}
              onChange={(e) => setDados((x) => ({ ...x, nome: e.target.value }))}
            />
          </label>
          <label style={{ display: "block", marginBottom: 12 }}>
            <span
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 700,
                color: ROXO_DARK,
                marginBottom: 5,
              }}
            >
              Celular / WhatsApp
            </span>
            <input
              style={inputStyle}
              placeholder="(00) 0 0000-0000"
              inputMode="tel"
              value={dados.celular}
              onChange={(e) => setDados((x) => ({ ...x, celular: e.target.value }))}
            />
          </label>
          <label style={{ display: "block", marginBottom: 4 }}>
            <span
              style={{
                display: "block",
                fontSize: 13,
                fontWeight: 700,
                color: ROXO_DARK,
                marginBottom: 5,
              }}
            >
              Endereço (bairro e cidade)
            </span>
            <input
              style={inputStyle}
              placeholder="Bairro, Cidade - UF"
              value={dados.endereco}
              onChange={(e) => setDados((x) => ({ ...x, endereco: e.target.value }))}
            />
          </label>
          <p style={{ fontSize: 11.5, color: "#9b93b0", margin: "8px 0 0" }}>
            E-mail da conta: {d?.dados?.email} (identifica seu acesso, não muda aqui).
          </p>
        </Card>
      )}

      {/* ============ 3. SUA HISTÓRIA ============ */}
      {etapa === "historia" && (
        <Card>
          <TituloEtapa
            icon={Heart}
            sub={
              d?.cv?.tem_arquivo
                ? "Seu currículo já contou bastante — se quiser, complemente com suas palavras (ou só continue)."
                : "Conte com suas palavras — a gente organiza tudo pra você nas próximas etapas."
            }
          >
            Sua história
          </TituloEtapa>
          {PERGUNTAS.map((p) => (
            <label key={p.chave} style={{ display: "block", marginBottom: 14 }}>
              <span
                style={{
                  display: "block",
                  fontSize: 13.5,
                  fontWeight: 700,
                  color: ROXO_DARK,
                  marginBottom: 6,
                }}
              >
                {p.label}
              </span>
              <textarea
                value={respostas[p.chave] ?? ""}
                onChange={(e) =>
                  setRespostas((r) => ({ ...r, [p.chave]: e.target.value.slice(0, 2000) }))
                }
                placeholder={p.placeholder}
                rows={3}
                style={{ ...inputStyle, resize: "vertical" }}
              />
            </label>
          ))}
        </Card>
      )}

      {/* ============ 4. FORMAÇÃO ============ */}
      {etapa === "formacao" && (
        <Card>
          <TituloEtapa
            icon={GraduationCap}
            sub="Estudos e cursos — do fundamental ao técnico ou faculdade."
          >
            Formação
          </TituloEtapa>
          {(d?.formacoes ?? []).length === 0 && !formAberta && (
            <p style={{ fontSize: 13, color: CINZA, margin: "0 0 10px" }}>
              Nenhuma formação ainda. Adicione sua escolaridade e cursos!
            </p>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
            {(d?.formacoes ?? []).map((f: any) => (
              <div
                key={f.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  border: `1px solid ${BORDA}`,
                  borderRadius: 11,
                  padding: "10px 12px",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ flex: "1 1 180px", minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: ROXO_DARK }}>
                    {f.titulo}
                  </div>
                  <div style={{ fontSize: 12, color: CINZA }}>
                    {[f.instituicao, f.ano, STATUS_FORM[f.status]].filter(Boolean).join(" · ")}
                  </div>
                </div>
                {f.origem === "ia" && (
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      color: ROXO,
                      background: ROXO_TINT,
                      padding: "2px 8px",
                      borderRadius: 99,
                    }}
                  >
                    IA
                  </span>
                )}
                <button
                  onClick={() => removerForm({ data: { id: f.id } as any }).then(invalidar)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#9b93b0",
                    cursor: "pointer",
                    padding: 4,
                  }}
                >
                  <X size={15} />
                </button>
              </div>
            ))}
          </div>
          {formAberta ? (
            <div style={{ borderTop: `1px solid ${BORDA}`, paddingTop: 12 }}>
              <input
                style={{ ...inputStyle, marginBottom: 8 }}
                placeholder="Ex.: Ensino médio completo, Técnico em Vendas..."
                value={formEdit.titulo}
                onChange={(e) => setFormEdit((x: any) => ({ ...x, titulo: e.target.value }))}
              />
              <div style={{ display: "flex", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                <input
                  style={{ ...inputStyle, flex: "2 1 160px", width: "auto" }}
                  placeholder="Escola / instituição (opcional)"
                  value={formEdit.instituicao}
                  onChange={(e) => setFormEdit((x: any) => ({ ...x, instituicao: e.target.value }))}
                />
                <input
                  style={{ ...inputStyle, flex: "1 1 80px", width: "auto" }}
                  placeholder="Ano"
                  value={formEdit.ano}
                  onChange={(e) => setFormEdit((x: any) => ({ ...x, ano: e.target.value }))}
                />
              </div>
              <div style={{ display: "flex", gap: 7, marginBottom: 10, flexWrap: "wrap" }}>
                {Object.entries(STATUS_FORM).map(([k, v]) => (
                  <button
                    key={k}
                    onClick={() => setFormEdit((x: any) => ({ ...x, status: k }))}
                    style={{
                      padding: "7px 12px",
                      borderRadius: 99,
                      fontSize: 12,
                      fontWeight: formEdit.status === k ? 700 : 500,
                      cursor: "pointer",
                      fontFamily: "inherit",
                      border: `1.5px solid ${formEdit.status === k ? ROXO : BORDA}`,
                      background: formEdit.status === k ? ROXO_TINT : "#fff",
                      color: formEdit.status === k ? ROXO_DARK : CINZA,
                    }}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={async () => {
                    if (!formEdit.titulo.trim()) return;
                    await salvarForm({
                      data: {
                        titulo: formEdit.titulo.trim(),
                        instituicao: formEdit.instituicao || null,
                        ano: formEdit.ano || null,
                        status: formEdit.status,
                      } as any,
                    });
                    setFormAberta(false);
                    setFormEdit({ titulo: "", instituicao: "", ano: "", status: "concluido" });
                    await invalidar();
                  }}
                  style={{ ...botaoPrimario, minHeight: 42, padding: "9px 16px", fontSize: 13 }}
                >
                  <Save size={14} /> Salvar
                </button>
                <button onClick={() => setFormAberta(false)} style={botaoSec}>
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setFormAberta(true)}
              style={{
                ...botaoPrimario,
                background: "#fff",
                color: ROXO,
                border: `1.5px solid ${BORDA}`,
                minHeight: 42,
                padding: "9px 15px",
                fontSize: 13,
              }}
            >
              <Plus size={15} /> Adicionar formação
            </button>
          )}
        </Card>
      )}

      {/* ============ 5. EXPERIÊNCIAS ============ */}
      {etapa === "experiencias" && (
        <Card>
          <TituloEtapa
            icon={Briefcase}
            sub="Vale tudo: com carteira, bico, informal, projeto, voluntariado."
          >
            Experiências
          </TituloEtapa>
          {(d?.experiencias ?? []).length === 0 && !expAberta && (
            <p style={{ fontSize: 13, color: CINZA, margin: "0 0 10px" }}>
              Nenhuma ainda — adicione a primeira!
            </p>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 12 }}>
            {(d?.experiencias ?? []).map((e: any) => {
              const selo = SELO_VALIDACAO[e.status_validacao] ?? SELO_VALIDACAO.declarada;
              return (
                <div
                  key={e.id}
                  style={{ border: `1px solid ${BORDA}`, borderRadius: 12, padding: "11px 13px" }}
                >
                  <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: ROXO_DARK,
                        flex: "1 1 160px",
                      }}
                    >
                      {e.titulo}
                    </span>
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        color: selo.cor,
                        background: selo.fundo,
                        padding: "3px 9px",
                        borderRadius: 99,
                      }}
                    >
                      {selo.rotulo}
                    </span>
                    <button
                      onClick={() => removerExp({ data: { id: e.id } as any }).then(invalidar)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#9b93b0",
                        cursor: "pointer",
                        padding: 4,
                      }}
                    >
                      <X size={15} />
                    </button>
                  </div>
                  <div style={{ fontSize: 12, color: CINZA, marginTop: 3 }}>
                    {TIPOS_EXP[e.tipo] ?? e.tipo}
                    {e.organizacao ? ` · ${e.organizacao}` : ""}
                  </div>
                  {e.status_validacao === "pendente_confirmacao" && e.pendencia && (
                    <div
                      style={{
                        marginTop: 8,
                        fontSize: 12.5,
                        color: "#9A5B13",
                        background: "#FFF7ED",
                        border: "1px solid #FED7AA",
                        borderRadius: 9,
                        padding: "8px 10px",
                      }}
                    >
                      {e.pendencia}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          {expAberta ? (
            <div style={{ borderTop: `1px solid ${BORDA}`, paddingTop: 12 }}>
              <select
                value={expEdit.tipo}
                onChange={(e) => setExpEdit((x: any) => ({ ...x, tipo: e.target.value }))}
                style={{ ...inputStyle, marginBottom: 8 }}
              >
                {Object.entries(TIPOS_EXP).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              <input
                style={{ ...inputStyle, marginBottom: 8 }}
                placeholder="O que você fazia? (ex.: Vendedora, Ajudante...)"
                value={expEdit.titulo}
                onChange={(e) => setExpEdit((x: any) => ({ ...x, titulo: e.target.value }))}
              />
              <input
                style={{ ...inputStyle, marginBottom: 8 }}
                placeholder="Onde? (empresa, pessoa, projeto...)"
                value={expEdit.organizacao}
                onChange={(e) => setExpEdit((x: any) => ({ ...x, organizacao: e.target.value }))}
              />
              <textarea
                style={{ ...inputStyle, resize: "vertical", marginBottom: 8 }}
                rows={2}
                placeholder="Conte um pouco (opcional)"
                value={expEdit.descricao}
                onChange={(e) => setExpEdit((x: any) => ({ ...x, descricao: e.target.value }))}
              />
              <div style={{ display: "flex", gap: 10 }}>
                <button
                  onClick={async () => {
                    if (!expEdit.titulo.trim()) return;
                    await salvarExp({
                      data: {
                        tipo: expEdit.tipo,
                        titulo: expEdit.titulo.trim(),
                        organizacao: expEdit.organizacao || null,
                        atual: false,
                        descricao: expEdit.descricao || null,
                      } as any,
                    });
                    setExpAberta(false);
                    setExpEdit({ tipo: "formal", titulo: "", organizacao: "", descricao: "" });
                    await invalidar();
                  }}
                  style={{ ...botaoPrimario, minHeight: 42, padding: "9px 16px", fontSize: 13 }}
                >
                  <Save size={14} /> Salvar
                </button>
                <button onClick={() => setExpAberta(false)} style={botaoSec}>
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setExpAberta(true)}
              style={{
                ...botaoPrimario,
                background: "#fff",
                color: ROXO,
                border: `1.5px solid ${BORDA}`,
                minHeight: 42,
                padding: "9px 15px",
                fontSize: 13,
              }}
            >
              <Plus size={15} /> Adicionar experiência
            </button>
          )}
        </Card>
      )}

      {/* ============ 6. HABILIDADES ============ */}
      {etapa === "habilidades" && (
        <Card>
          <TituloEtapa icon={Star} sub="O que você sabe fazer, com o seu nível (as bolinhas).">
            Habilidades
          </TituloEtapa>
          {(d?.competencias ?? []).length === 0 && (
            <p style={{ fontSize: 13, color: CINZA, margin: 0 }}>
              Nada por aqui ainda — envie seu currículo ou conte sua história nas etapas anteriores,
              que a IA identifica suas habilidades.
            </p>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(d?.competencias ?? []).map((c: any) => (
              <div
                key={c.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 8,
                  border: `1px solid ${BORDA}`,
                  borderRadius: 11,
                  padding: "9px 12px",
                }}
              >
                <span
                  style={{ fontSize: 13.5, fontWeight: 700, color: ROXO_DARK, flex: "1 1 140px" }}
                >
                  {c.competencia?.nome}
                </span>
                {c.origem === "ia" && (
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      color: ROXO,
                      background: ROXO_TINT,
                      padding: "2px 8px",
                      borderRadius: 99,
                    }}
                  >
                    IA{typeof c.confianca === "number" ? ` ${Math.round(c.confianca * 100)}%` : ""}
                  </span>
                )}
                <span style={{ display: "inline-flex", gap: 3 }}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      onClick={() =>
                        salvarComp({
                          data: { competencia_id: c.competencia?.id, nivel: n } as any,
                        }).then(invalidar)
                      }
                      title={`Nível ${n}`}
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: 99,
                        border: `1.5px solid ${ROXO}`,
                        background: n <= c.nivel ? ROXO : "#fff",
                        cursor: "pointer",
                        padding: 0,
                      }}
                    />
                  ))}
                </span>
                <button
                  onClick={() => removerComp({ data: { id: c.id } as any }).then(invalidar)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#9b93b0",
                    cursor: "pointer",
                    padding: 4,
                  }}
                >
                  <X size={15} />
                </button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ============ 7. PREFERÊNCIAS ============ */}
      {etapa === "preferencias" && (
        <Card>
          <TituloEtapa icon={Heart} sub="Como o trabalho ideal seria pra você.">
            Preferências
          </TituloEtapa>
          <span
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 700,
              color: ROXO_DARK,
              marginBottom: 6,
            }}
          >
            Disponibilidade de horário
          </span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 14 }}>
            {DISPONIBILIDADES.map((op) => {
              const selecionados = String(prefs.disponibilidade ?? "")
                .split(", ")
                .filter(Boolean);
              const on = selecionados.includes(op);
              return (
                <button
                  key={op}
                  onClick={() => {
                    const novos = on
                      ? selecionados.filter((s) => s !== op)
                      : op === "Qualquer horário"
                        ? ["Qualquer horário"]
                        : [...selecionados.filter((s) => s !== "Qualquer horário"), op];
                    setPrefs((p: any) => ({ ...p, disponibilidade: novos.join(", ") }));
                  }}
                  style={chipStyle(on)}
                >
                  {op}
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
            <label style={{ flex: 1 }}>
              <span
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 700,
                  color: ROXO_DARK,
                  marginBottom: 5,
                }}
              >
                Quero ganhar de (R$)
              </span>
              <input
                style={inputStyle}
                type="number"
                value={prefs.pretensao_min}
                onChange={(e) => setPrefs((p: any) => ({ ...p, pretensao_min: e.target.value }))}
              />
            </label>
            <label style={{ flex: 1 }}>
              <span
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 700,
                  color: ROXO_DARK,
                  marginBottom: 5,
                }}
              >
                Até (R$)
              </span>
              <input
                style={inputStyle}
                type="number"
                value={prefs.pretensao_max}
                onChange={(e) => setPrefs((p: any) => ({ ...p, pretensao_max: e.target.value }))}
              />
            </label>
          </div>
          <span
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 700,
              color: ROXO_DARK,
              marginBottom: 6,
            }}
          >
            Como você prefere trabalhar
          </span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 12 }}>
            {(
              [
                ["presencial", "Presencial"],
                ["hibrido", "Híbrido"],
                ["remoto", "Remoto"],
                ["indiferente", "Tanto faz"],
              ] as const
            ).map(([valor, rotulo]) => {
              const on = prefs.modelo_trabalho === valor;
              return (
                <button
                  key={valor}
                  onClick={() =>
                    setPrefs((p: any) => ({ ...p, modelo_trabalho: on ? null : valor }))
                  }
                  style={{
                    padding: "8px 14px",
                    borderRadius: 99,
                    fontSize: 12.5,
                    fontWeight: on ? 700 : 500,
                    cursor: "pointer",
                    fontFamily: "inherit",
                    border: `1.5px solid ${on ? ROXO : BORDA}`,
                    background: on ? ROXO_TINT : "#fff",
                    color: on ? ROXO_DARK : CINZA,
                  }}
                >
                  {rotulo}
                </button>
              );
            })}
          </div>
          <span
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 700,
              color: ROXO_DARK,
              marginBottom: 6,
            }}
          >
            Áreas que me interessam
          </span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 8 }}>
            {/* Sugestões clicáveis + o que a pessoa adicionou por conta própria. */}
            {[
              ...INTERESSES_SUGERIDOS,
              ...prefs.interesses.filter((t: string) => !INTERESSES_SUGERIDOS.includes(t)),
            ].map((tag: string) => {
              const on = prefs.interesses.includes(tag);
              return (
                <button
                  key={tag}
                  onClick={() =>
                    setPrefs((p: any) => ({
                      ...p,
                      interesses: on
                        ? p.interesses.filter((t: string) => t !== tag)
                        : [...new Set([...p.interesses, tag])].slice(0, 20),
                    }))
                  }
                  style={{
                    ...chipStyle(on),
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                  }}
                >
                  {tag}
                  {on && <X size={12} />}
                </button>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              style={{ ...inputStyle, flex: 1, width: "auto" }}
              placeholder="Outra área? Digite aqui..."
              value={novoInteresse}
              onChange={(e) => setNovoInteresse(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && novoInteresse.trim()) {
                  setPrefs((p: any) => ({
                    ...p,
                    interesses: [...new Set([...p.interesses, novoInteresse.trim()])].slice(0, 20),
                  }));
                  setNovoInteresse("");
                }
              }}
            />
            <button
              onClick={() => {
                if (!novoInteresse.trim()) return;
                setPrefs((p: any) => ({
                  ...p,
                  interesses: [...new Set([...p.interesses, novoInteresse.trim()])].slice(0, 20),
                }));
                setNovoInteresse("");
              }}
              style={{
                background: "#fff",
                color: ROXO,
                border: `1.5px solid ${BORDA}`,
                borderRadius: 11,
                width: 44,
                cursor: "pointer",
              }}
            >
              <Plus size={16} />
            </button>
          </div>
        </Card>
      )}

      {/* ============ 8. FIM ============ */}
      {etapa === "fim" && (
        <Card>
          <div style={{ textAlign: "center", padding: "10px 0" }}>
            <CheckCircle2 size={40} color={VERDE} />
            <h2
              className="h"
              style={{ fontSize: 21, fontWeight: 800, margin: "10px 0 6px", color: ROXO_DARK }}
            >
              Perfil pronto{dados.nome ? `, ${dados.nome.split(" ")[0]}` : ""}! 🎉
            </h2>
            {d?.resumo_ia && (
              <p style={{ fontSize: 13.5, color: CINZA, lineHeight: 1.6, margin: "0 0 16px" }}>
                {d.resumo_ia}
              </p>
            )}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 10,
                maxWidth: 340,
                margin: "0 auto",
              }}
            >
              <button onClick={verMeuCurriculo} disabled={ocupado} style={botaoPrimario}>
                {ocupado ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
                {ocupado
                  ? ocupadoTexto
                  : d?.cv?.tem_gerado
                    ? "Ver meu currículo (PDF)"
                    : "Criar meu currículo (PDF)"}
              </button>
              <button
                onClick={() => navigate({ to: "/portal" as any })}
                style={{
                  ...botaoPrimario,
                  background: "#fff",
                  color: ROXO,
                  border: `1.5px solid ${BORDA}`,
                }}
              >
                Ir para minhas candidaturas
              </button>
            </div>
            {/* Consentimento: aparecer no banco de talentos (empresa-puxa) */}
            <button
              onClick={() =>
                setVisibilidade({ data: { visivel: !d?.visivel_pool } as any }).then(invalidar)
              }
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                width: "100%",
                maxWidth: 340,
                margin: "16px auto 0",
                textAlign: "left",
                background: d?.visivel_pool ? "#F0FDF4" : "#fff",
                border: `1.5px solid ${d?.visivel_pool ? "#BBF7D0" : BORDA}`,
                borderRadius: 12,
                padding: "12px 14px",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              <div
                style={{
                  width: 38,
                  height: 22,
                  borderRadius: 99,
                  background: d?.visivel_pool ? VERDE : "#D8D2E6",
                  position: "relative",
                  flexShrink: 0,
                  transition: "background .15s",
                }}
              >
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 99,
                    background: "#fff",
                    position: "absolute",
                    top: 2,
                    left: d?.visivel_pool ? 18 : 2,
                    transition: "left .15s",
                  }}
                />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: ROXO_DARK }}>
                  Quero ser encontrado(a) por empresas
                </div>
                <div style={{ fontSize: 11.5, color: CINZA, lineHeight: 1.45 }}>
                  Seu perfil aparece no banco de talentos SEM nome e contato — a empresa só vê seus
                  dados se você aceitar o convite dela.
                </div>
              </div>
            </button>
            <p style={{ fontSize: 12, color: "#9b93b0", margin: "14px 0 0", lineHeight: 1.5 }}>
              Você pode voltar aqui quando quiser para atualizar qualquer etapa.
            </p>
          </div>
        </Card>
      )}

      {/* Navegação Voltar/Continuar (menos na 1ª e na última) */}
      {etapa !== "curriculo" && etapa !== "fim" && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: 6,
          }}
        >
          <button onClick={() => irPara(-1)} disabled={ocupado} style={botaoSec}>
            <ChevronLeft size={17} /> Voltar
          </button>
          <button
            onClick={() => {
              if (etapa === "dados") continuarDados();
              else if (etapa === "historia") continuarHistoria();
              else if (etapa === "preferencias") continuarPreferencias();
              else irPara(1);
            }}
            disabled={ocupado}
            style={botaoPrimario}
          >
            {ocupado ? <Loader2 size={16} className="spin" /> : null}
            {ocupado ? ocupadoTexto : "Continuar"} {!ocupado && <ChevronRight size={17} />}
          </button>
        </div>
      )}
    </div>
  );
}
