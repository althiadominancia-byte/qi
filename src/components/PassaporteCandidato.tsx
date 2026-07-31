import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Award,
  Briefcase,
  ExternalLink,
  FileText,
  IdCard,
  Image as ImageIcon,
  Link2,
  Loader2,
  Lock,
  Pencil,
  Plus,
  Save,
  Star,
  Target,
  Trash2,
  Wrench,
  X,
} from "lucide-react";
import {
  listCompetenciasDaCandidatura,
  removerMinhaCompetencia,
  removerMinhaEvidencia,
  removerMinhaExperiencia,
  salvarMinhaCompetencia,
  salvarMinhaEvidencia,
  salvarMinhaExperiencia,
  salvarMinhasPreferencias,
  urlMinhaEvidencia,
} from "@/lib/portal-candidato.functions";
import { supabase } from "@/integrations/supabase/client";
import { fmtSize, prepararCv } from "@/lib/recrutamento/cv-upload";
import { ROXO, ROXO_DARK, ROXO_TINT, LARANJA, CINZA, BORDA, VERDE } from "@/lib/recrutamento/data";

// Passaporte de Talentos — VARIANTE DO CANDIDATO (portal). Diferente do
// PassaporteBloco do recrutador: aqui o TITULAR edita o próprio passaporte.
// Regras: competências com origem 'ia'/'avaliada' são travadas (cadeado, sem
// remover); só as 'declaradas' podem ser ajustadas ou removidas.
// Recebe os dados iniciais via props e invalida a query da página
// (["minha-candidatura", candidatoId]) após cada alteração.

export type PassaporteDados = {
  competencias: any[];
  experiencias: any[];
  preferencias: any | null;
  evidencias?: any[];
};

const TIPO_COR: Record<string, string> = {
  tecnica: "#3B6FB0",
  comportamental: "#2E8B7A",
  transversal: "#8A5AC0",
};
const TIPO_EXP_LABEL: Record<string, string> = {
  formal: "Emprego",
  informal: "Trabalho informal",
  voluntariado: "Voluntariado",
  projeto: "Projeto",
  curso: "Curso",
};
const MODELOS: { valor: string; rotulo: string }[] = [
  { valor: "presencial", rotulo: "Presencial" },
  { valor: "hibrido", rotulo: "Híbrido" },
  { valor: "remoto", rotulo: "Remoto" },
  { valor: "indiferente", rotulo: "Tanto faz" },
];

// Evidências do passaporte ("provas e certificados")
const TIPO_EVID_LABEL: Record<string, string> = {
  projeto: "Projeto",
  certificado: "Certificado",
  portfolio: "Portfólio",
  experiencia: "Experiência",
  desafio: "Desafio",
  link: "Link",
};
const TIPO_EVID_ICONE: Record<string, any> = {
  projeto: Wrench,
  certificado: Award,
  portfolio: ImageIcon,
  experiencia: Briefcase,
  desafio: Target,
  link: Link2,
};
const EVID_MAX_MB = 5;
const EVID_EXTS = ["pdf", "jpg", "jpeg", "png", "webp"];

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  border: `1.5px solid ${BORDA}`,
  borderRadius: 10,
  fontSize: 13.5,
  outline: "none",
  background: "#fff",
  color: ROXO_DARK,
  boxSizing: "border-box",
  fontFamily: "inherit",
};
const sel: React.CSSProperties = { ...inputStyle, flex: "1 1 180px", width: "auto" };
const btnSec: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  background: "#fff",
  color: ROXO,
  border: `1.5px solid ${BORDA}`,
  padding: "9px 14px",
  borderRadius: 10,
  fontSize: 12.5,
  fontWeight: 700,
  cursor: "pointer",
  fontFamily: "inherit",
};
const btnPri = (habilitado: boolean): React.CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  background: habilitado ? ROXO : "#D8D2E6",
  color: "#fff",
  border: "none",
  padding: "10px 16px",
  borderRadius: 10,
  fontSize: 13,
  fontWeight: 700,
  cursor: habilitado ? "pointer" : "not-allowed",
  fontFamily: "inherit",
  minHeight: 42,
});

function SubTitulo({ icon: Icon, cor = ROXO, children }: any) {
  return (
    <div
      style={{
        fontSize: 12.5,
        fontWeight: 800,
        color: ROXO_DARK,
        margin: "0 0 8px",
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      <Icon size={14} color={cor} /> {children}
    </div>
  );
}
function ErroInline({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
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
      {msg}
    </div>
  );
}

const expVazia = {
  id: undefined as string | undefined,
  tipo: "formal",
  titulo: "",
  organizacao: "",
  inicio: "",
  fim: "",
  atual: false,
  descricao: "",
};

export function PassaporteCandidato({
  candidatoId,
  passaporte,
  empresaId,
}: {
  candidatoId: string;
  passaporte: PassaporteDados;
  /**
   * Empresa da candidatura — necessária para montar o path de upload das
   * evidências (`${empresaId}/${candidatoId}/...` no bucket "evidencias").
   * Sem ela o envio de ARQUIVO fica oculto e o candidato só pode usar link.
   */
  empresaId?: string | null;
}) {
  const qc = useQueryClient();
  const fetchTax = useServerFn(listCompetenciasDaCandidatura);
  const salvarComp = useServerFn(salvarMinhaCompetencia);
  const removerComp = useServerFn(removerMinhaCompetencia);
  const salvarExp = useServerFn(salvarMinhaExperiencia);
  const removerExp = useServerFn(removerMinhaExperiencia);
  const salvarPrefs = useServerFn(salvarMinhasPreferencias);
  const salvarEvid = useServerFn(salvarMinhaEvidencia);
  const removerEvid = useServerFn(removerMinhaEvidencia);
  const urlEvid = useServerFn(urlMinhaEvidencia);

  const taxQ = useQuery({
    queryKey: ["competencias-candidatura", candidatoId],
    queryFn: () => fetchTax({ data: { candidatoId } }) as Promise<any[]>,
  });

  const comps: any[] = useMemo(() => passaporte?.competencias ?? [], [passaporte]);
  const exps: any[] = passaporte?.experiencias ?? [];
  const prefIniciais = passaporte?.preferencias ?? null;

  const invalidar = () => qc.invalidateQueries({ queryKey: ["minha-candidatura", candidatoId] });

  // ===== Competências =====
  const [novaComp, setNovaComp] = useState("");
  const [nivel, setNivel] = useState(3);
  const [salvandoComp, setSalvandoComp] = useState(false);
  const [erroComp, setErroComp] = useState("");
  const jaTem = useMemo(() => new Set(comps.map((c) => c.competencia?.id)), [comps]);
  const disponiveis = (taxQ.data ?? []).filter((t) => !jaTem.has(t.id));

  async function onAddComp() {
    if (!novaComp || salvandoComp) return;
    setSalvandoComp(true);
    setErroComp("");
    try {
      await salvarComp({ data: { candidatoId, competencia_id: novaComp, nivel } });
      setNovaComp("");
      setNivel(3);
      await invalidar();
    } catch (e: any) {
      setErroComp(e?.message || "Não foi possível adicionar.");
    } finally {
      setSalvandoComp(false);
    }
  }
  async function onNivelComp(competenciaId: string, novoNivel: number) {
    setErroComp("");
    try {
      await salvarComp({ data: { candidatoId, competencia_id: competenciaId, nivel: novoNivel } });
      await invalidar();
    } catch (e: any) {
      setErroComp(e?.message || "Não foi possível ajustar o nível.");
    }
  }
  async function onRemoveComp(id: string) {
    setErroComp("");
    try {
      await removerComp({ data: { candidatoId, id } });
      await invalidar();
    } catch (e: any) {
      setErroComp(e?.message || "Não foi possível remover.");
    }
  }

  // ===== Experiências =====
  const [formExp, setFormExp] = useState<typeof expVazia | null>(null);
  const [salvandoExp, setSalvandoExp] = useState(false);
  const [erroExp, setErroExp] = useState("");
  const setExp = (k: string, v: any) => setFormExp((p) => (p ? { ...p, [k]: v } : p));

  async function onSalvarExp() {
    if (!formExp || !formExp.titulo.trim() || salvandoExp) return;
    setSalvandoExp(true);
    setErroExp("");
    try {
      await salvarExp({
        data: {
          candidatoId,
          id: formExp.id,
          tipo: formExp.tipo as any,
          titulo: formExp.titulo.trim(),
          organizacao: formExp.organizacao.trim() || null,
          inicio: formExp.inicio || null,
          fim: formExp.atual ? null : formExp.fim || null,
          atual: formExp.atual,
          descricao: formExp.descricao.trim() || null,
        },
      });
      setFormExp(null);
      await invalidar();
    } catch (e: any) {
      setErroExp(e?.message || "Não foi possível salvar a experiência.");
    } finally {
      setSalvandoExp(false);
    }
  }
  async function onRemoveExp(id: string) {
    setErroExp("");
    try {
      await removerExp({ data: { candidatoId, id } });
      await invalidar();
    } catch (e: any) {
      setErroExp(e?.message || "Não foi possível remover.");
    }
  }

  // ===== Evidências (provas e certificados) =====
  const evids: any[] = passaporte?.evidencias ?? [];
  // Sem empresaId (página ainda não passa a prop) não dá para montar o path de
  // upload — escondemos a opção de arquivo e deixamos só o link.
  const podeArquivo = !!empresaId;
  const [formEvidAberto, setFormEvidAberto] = useState(false);
  const [evTipo, setEvTipo] = useState("projeto");
  const [evTitulo, setEvTitulo] = useState("");
  const [evDescricao, setEvDescricao] = useState("");
  const [evUrl, setEvUrl] = useState("");
  const [evArquivo, setEvArquivo] = useState<File | null>(null);
  const [salvandoEvid, setSalvandoEvid] = useState(false);
  const [erroEvid, setErroEvid] = useState("");
  const [abrindoEvid, setAbrindoEvid] = useState<string | null>(null);

  function limparFormEvid() {
    setFormEvidAberto(false);
    setEvTipo("projeto");
    setEvTitulo("");
    setEvDescricao("");
    setEvUrl("");
    setEvArquivo(null);
    setErroEvid("");
  }

  function onEscolherArquivoEvid(file: File | null) {
    setErroEvid("");
    if (!file) {
      setEvArquivo(null);
      return;
    }
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!EVID_EXTS.includes(ext)) {
      setErroEvid("Formato não suportado. Envie PDF, JPG, PNG ou WEBP.");
      return;
    }
    setEvArquivo(file);
  }

  async function onSalvarEvid() {
    const titulo = evTitulo.trim();
    const url = evUrl.trim();
    if (!titulo || salvandoEvid) return;
    if (!url && !evArquivo) {
      setErroEvid("Informe um link ou envie um arquivo.");
      return;
    }
    if (url && evArquivo) {
      setErroEvid("Escolha só um: o link OU o arquivo.");
      return;
    }
    if (url) {
      try {
        new URL(url);
      } catch {
        setErroEvid("Link inválido. Comece com https:// (ex.: https://meuprojeto.com).");
        return;
      }
    }
    setSalvandoEvid(true);
    setErroEvid("");
    try {
      let storagePath: string | null = null;
      if (evArquivo) {
        if (!empresaId) throw new Error("Envio de arquivo indisponível no momento. Use um link.");
        let arquivo = evArquivo;
        const ehImagem =
          arquivo.type.startsWith("image/") || /\.(jpe?g|png|webp)$/i.test(arquivo.name);
        if (ehImagem) {
          // Reusa a compressão de imagem do fluxo de currículo.
          arquivo = (await prepararCv(arquivo)).arquivo;
        }
        if (arquivo.size > EVID_MAX_MB * 1024 * 1024) {
          throw new Error(
            `Arquivo muito grande (${fmtSize(arquivo.size)}). O limite é ${EVID_MAX_MB} MB.`,
          );
        }
        const ext = arquivo.name.split(".").pop()?.toLowerCase() || "bin";
        const path = `${empresaId}/${candidatoId}/${crypto.randomUUID()}.${ext}`;
        const { error } = await supabase.storage
          .from("evidencias")
          .upload(path, arquivo, { contentType: arquivo.type || undefined });
        if (error) throw new Error("Não foi possível enviar o arquivo. Tente de novo.");
        storagePath = path;
      }
      await salvarEvid({
        data: {
          candidatoId,
          tipo: evTipo as any,
          titulo,
          descricao: evDescricao.trim() || null,
          url: url || null,
          storagePath,
        },
      });
      limparFormEvid();
      await invalidar();
    } catch (e: any) {
      setErroEvid(e?.message || "Não foi possível salvar.");
    } finally {
      setSalvandoEvid(false);
    }
  }

  async function onRemoveEvid(id: string) {
    if (!window.confirm("Remover esta prova/certificado?")) return;
    setErroEvid("");
    try {
      await removerEvid({ data: { candidatoId, id } });
      await invalidar();
    } catch (e: any) {
      setErroEvid(e?.message || "Não foi possível remover.");
    }
  }

  async function onVerArquivoEvid(id: string) {
    if (abrindoEvid) return;
    setAbrindoEvid(id);
    setErroEvid("");
    try {
      const r: any = await urlEvid({ data: { candidatoId, id } });
      if (r?.url) window.open(r.url, "_blank", "noopener");
    } catch (e: any) {
      setErroEvid(e?.message || "Não foi possível abrir o arquivo.");
    } finally {
      setAbrindoEvid(null);
    }
  }

  // ===== Preferências =====
  const [disponibilidade, setDisponibilidade] = useState<string>(
    prefIniciais?.disponibilidade ?? "",
  );
  const [preMin, setPreMin] = useState<string>(
    prefIniciais?.pretensao_min != null ? String(prefIniciais.pretensao_min) : "",
  );
  const [preMax, setPreMax] = useState<string>(
    prefIniciais?.pretensao_max != null ? String(prefIniciais.pretensao_max) : "",
  );
  const [modelo, setModelo] = useState<string>(prefIniciais?.modelo_trabalho ?? "");
  const [interesses, setInteresses] = useState<string[]>(
    Array.isArray(prefIniciais?.interesses) ? prefIniciais.interesses : [],
  );
  const [novoInteresse, setNovoInteresse] = useState("");
  const [salvandoPrefs, setSalvandoPrefs] = useState(false);
  const [msgPrefs, setMsgPrefs] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  function addInteresse() {
    const v = novoInteresse.trim();
    if (!v || interesses.includes(v)) {
      setNovoInteresse("");
      return;
    }
    setInteresses((p) => [...p, v]);
    setNovoInteresse("");
  }
  async function onSalvarPrefs() {
    if (salvandoPrefs) return;
    setSalvandoPrefs(true);
    setMsgPrefs(null);
    try {
      await salvarPrefs({
        data: {
          candidatoId,
          disponibilidade: disponibilidade.trim() || null,
          pretensao_min: preMin ? Number(preMin) : null,
          pretensao_max: preMax ? Number(preMax) : null,
          modelo_trabalho: (modelo || null) as any,
          interesses,
        },
      });
      setMsgPrefs({ tipo: "ok", texto: "Preferências salvas." });
      await invalidar();
    } catch (e: any) {
      setMsgPrefs({ tipo: "erro", texto: e?.message || "Não foi possível salvar." });
    } finally {
      setSalvandoPrefs(false);
    }
  }

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
      <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 6 }}>
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
          <IdCard size={17} color={ROXO} />
        </div>
        <h2 className="h" style={{ fontSize: 17, fontWeight: 800, margin: 0 }}>
          Meu passaporte de talentos
        </h2>
      </div>
      <p style={{ fontSize: 12.5, color: CINZA, lineHeight: 1.55, margin: "0 0 16px" }}>
        Conte o que você sabe fazer. Essas informações ajudam a empresa a conhecer você melhor.
      </p>

      {/* ===== Competências ===== */}
      <SubTitulo icon={Star}>O que eu sei fazer</SubTitulo>
      <ErroInline msg={erroComp} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
        {comps.map((c) => {
          const cor = TIPO_COR[c.competencia?.tipo] ?? ROXO;
          const travada = c.origem !== "declarada";
          return (
            <div
              key={c.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 7,
                border: `1px solid color-mix(in srgb, ${cor} 30%, white)`,
                background: `color-mix(in srgb, ${cor} 6%, white)`,
                borderRadius: 99,
                padding: travada ? "5px 11px" : "5px 6px 5px 11px",
              }}
            >
              <span style={{ fontSize: 12.5, fontWeight: 700, color: ROXO_DARK }}>
                {c.competencia?.nome}
              </span>
              <span style={{ display: "flex", gap: 2 }}>
                {[1, 2, 3, 4, 5].map((n) =>
                  travada ? (
                    <span
                      key={n}
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: 99,
                        background: n <= c.nivel ? cor : "#E6E1F0",
                      }}
                    />
                  ) : (
                    <button
                      key={n}
                      onClick={() => onNivelComp(c.competencia?.id, n)}
                      title={`Nível ${n}`}
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 99,
                        background: n <= c.nivel ? cor : "#E6E1F0",
                        border: "none",
                        cursor: "pointer",
                        padding: 0,
                      }}
                    />
                  ),
                )}
              </span>
              {travada && (
                <span
                  title={
                    c.origem === "avaliada"
                      ? "Avaliada pela empresa"
                      : "Identificada no seu currículo"
                  }
                  style={{ display: "flex", alignItems: "center", gap: 4 }}
                >
                  <Lock size={11} color={CINZA} />
                  <span
                    style={{
                      fontSize: 9.5,
                      fontWeight: 800,
                      color: c.origem === "avaliada" ? VERDE : LARANJA,
                      textTransform: "uppercase",
                    }}
                  >
                    {c.origem === "avaliada" ? "avaliada pela empresa" : "do seu currículo"}
                  </span>
                </span>
              )}
              {!travada && (
                <button
                  onClick={() => onRemoveComp(c.id)}
                  title="Remover"
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#9b93b0",
                    display: "flex",
                    padding: 2,
                  }}
                >
                  <X size={13} />
                </button>
              )}
            </div>
          );
        })}
        {comps.length === 0 && (
          <span style={{ fontSize: 12.5, color: "#9b93b0" }}>
            Você ainda não adicionou nenhuma habilidade. Adicione abaixo!
          </span>
        )}
      </div>
      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: 20,
        }}
      >
        <select value={novaComp} onChange={(e) => setNovaComp(e.target.value)} style={sel}>
          <option value="">Adicionar habilidade…</option>
          {disponiveis.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nome}
            </option>
          ))}
        </select>
        <select
          value={nivel}
          onChange={(e) => setNivel(Number(e.target.value))}
          style={{ ...inputStyle, width: "auto" }}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>
              Nível {n}
            </option>
          ))}
        </select>
        <button
          onClick={onAddComp}
          disabled={!novaComp || salvandoComp}
          style={{
            ...btnSec,
            opacity: novaComp ? 1 : 0.5,
            cursor: novaComp ? "pointer" : "not-allowed",
          }}
        >
          {salvandoComp ? <Loader2 size={13} className="spin" /> : <Plus size={13} />} Adicionar
        </button>
      </div>

      {/* ===== Experiências ===== */}
      <SubTitulo icon={Briefcase}>Onde eu já trabalhei ou estudei</SubTitulo>
      <ErroInline msg={erroExp} />
      <div style={{ display: "grid", gap: 7, marginBottom: 10 }}>
        {exps.map((e) => (
          <div
            key={e.id}
            style={{ border: `1px solid ${BORDA}`, borderRadius: 10, padding: "10px 12px" }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: ROXO_DARK }}>{e.titulo}</span>
              {e.organizacao && (
                <span style={{ fontSize: 12, color: CINZA }}>· {e.organizacao}</span>
              )}
              <span
                style={{
                  fontSize: 9.5,
                  fontWeight: 800,
                  color: ROXO,
                  background: ROXO_TINT,
                  padding: "1px 7px",
                  borderRadius: 99,
                  textTransform: "uppercase",
                }}
              >
                {TIPO_EXP_LABEL[e.tipo] ?? e.tipo}
              </span>
              {e.atual && (
                <span
                  style={{
                    fontSize: 9.5,
                    fontWeight: 800,
                    color: VERDE,
                    textTransform: "uppercase",
                  }}
                >
                  atual
                </span>
              )}
              <span style={{ marginLeft: "auto", display: "flex", gap: 2 }}>
                <button
                  onClick={() =>
                    setFormExp({
                      id: e.id,
                      tipo: e.tipo ?? "formal",
                      titulo: e.titulo ?? "",
                      organizacao: e.organizacao ?? "",
                      inicio: e.inicio ?? "",
                      fim: e.fim ?? "",
                      atual: !!e.atual,
                      descricao: e.descricao ?? "",
                    })
                  }
                  title="Editar"
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: CINZA,
                    display: "flex",
                    padding: 4,
                  }}
                >
                  <Pencil size={13} />
                </button>
                <button
                  onClick={() => onRemoveExp(e.id)}
                  title="Remover"
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#9b93b0",
                    display: "flex",
                    padding: 4,
                  }}
                >
                  <Trash2 size={13} />
                </button>
              </span>
            </div>
            {e.descricao && (
              <div style={{ fontSize: 12, color: CINZA, marginTop: 3, lineHeight: 1.5 }}>
                {e.descricao}
              </div>
            )}
          </div>
        ))}
        {exps.length === 0 && (
          <span style={{ fontSize: 12.5, color: "#9b93b0" }}>
            Nenhuma experiência ainda. Vale contar até trabalhos informais, bicos e cursos.
          </span>
        )}
      </div>

      {!formExp ? (
        <button onClick={() => setFormExp({ ...expVazia })} style={{ ...btnSec, marginBottom: 20 }}>
          <Plus size={13} /> Adicionar experiência
        </button>
      ) : (
        <div
          style={{
            border: `1.5px solid ${BORDA}`,
            borderRadius: 12,
            padding: 14,
            marginBottom: 20,
            background: "#FBFAFE",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 800, color: ROXO_DARK, marginBottom: 10 }}>
            {formExp.id ? "Editar experiência" : "Nova experiência"}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginBottom: 10 }}>
            {Object.entries(TIPO_EXP_LABEL).map(([valor, rotulo]) => (
              <button
                key={valor}
                type="button"
                onClick={() => setExp("tipo", valor)}
                style={{
                  padding: "7px 12px",
                  borderRadius: 99,
                  fontSize: 12,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  border: `1.5px solid ${formExp.tipo === valor ? ROXO : BORDA}`,
                  background: formExp.tipo === valor ? ROXO_TINT : "#fff",
                  color: formExp.tipo === valor ? ROXO_DARK : CINZA,
                  fontWeight: formExp.tipo === valor ? 700 : 500,
                }}
              >
                {rotulo}
              </button>
            ))}
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            <input
              style={inputStyle}
              placeholder="O que você fazia? Ex.: Vendedora, Atendente..."
              value={formExp.titulo}
              onChange={(e) => setExp("titulo", e.target.value)}
            />
            <input
              style={inputStyle}
              placeholder="Onde? (empresa, loja, escola...)"
              value={formExp.organizacao}
              onChange={(e) => setExp("organizacao", e.target.value)}
            />
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <label style={{ flex: "1 1 130px" }}>
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: CINZA,
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Começou em
                </span>
                <input
                  type="date"
                  style={inputStyle}
                  value={formExp.inicio}
                  onChange={(e) => setExp("inicio", e.target.value)}
                />
              </label>
              <label style={{ flex: "1 1 130px", opacity: formExp.atual ? 0.5 : 1 }}>
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: CINZA,
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Terminou em
                </span>
                <input
                  type="date"
                  style={inputStyle}
                  value={formExp.fim}
                  disabled={formExp.atual}
                  onChange={(e) => setExp("fim", e.target.value)}
                />
              </label>
            </div>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontSize: 13,
                color: ROXO_DARK,
                cursor: "pointer",
              }}
            >
              <input
                type="checkbox"
                checked={formExp.atual}
                onChange={(e) => setExp("atual", e.target.checked)}
              />
              Trabalho aqui atualmente
            </label>
            <textarea
              style={{ ...inputStyle, minHeight: 70, resize: "vertical" }}
              placeholder="Conte rapidinho o que você fazia (opcional)"
              value={formExp.descricao}
              onChange={(e) => setExp("descricao", e.target.value)}
            />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button
              onClick={onSalvarExp}
              disabled={!formExp.titulo.trim() || salvandoExp}
              style={btnPri(!!formExp.titulo.trim() && !salvandoExp)}
            >
              {salvandoExp ? <Loader2 size={14} className="spin" /> : <Save size={14} />} Salvar
            </button>
            <button
              onClick={() => {
                setFormExp(null);
                setErroExp("");
              }}
              style={btnSec}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ===== Evidências (provas e certificados) ===== */}
      <SubTitulo icon={Award} cor={LARANJA}>
        Minhas provas e certificados
      </SubTitulo>
      <p style={{ fontSize: 12.5, color: CINZA, lineHeight: 1.55, margin: "0 0 10px" }}>
        Mostre o que você já fez: fotos de trabalhos, certificados de cursos, links de projetos.
      </p>
      <ErroInline msg={erroEvid} />
      <div style={{ display: "grid", gap: 7, marginBottom: 10 }}>
        {evids.map((ev) => {
          const Icone = TIPO_EVID_ICONE[ev.tipo] ?? FileText;
          return (
            <div
              key={ev.id}
              style={{ border: `1px solid ${BORDA}`, borderRadius: 10, padding: "10px 12px" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                <Icone size={14} color={ROXO} style={{ flexShrink: 0 }} />
                <span style={{ fontSize: 13.5, fontWeight: 700, color: ROXO_DARK }}>
                  {ev.titulo}
                </span>
                <span
                  style={{
                    fontSize: 9.5,
                    fontWeight: 800,
                    color: ROXO,
                    background: ROXO_TINT,
                    padding: "1px 7px",
                    borderRadius: 99,
                    textTransform: "uppercase",
                  }}
                >
                  {TIPO_EVID_LABEL[ev.tipo] ?? ev.tipo}
                </span>
                {ev.created_at && (
                  <span style={{ fontSize: 11, color: "#9b93b0" }}>
                    {new Date(ev.created_at).toLocaleDateString("pt-BR")}
                  </span>
                )}
                <span style={{ marginLeft: "auto", display: "flex", gap: 2 }}>
                  <button
                    onClick={() => onRemoveEvid(ev.id)}
                    title="Remover"
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      color: "#9b93b0",
                      display: "flex",
                      padding: 4,
                    }}
                  >
                    <Trash2 size={13} />
                  </button>
                </span>
              </div>
              {ev.descricao && (
                <div style={{ fontSize: 12, color: CINZA, marginTop: 3, lineHeight: 1.5 }}>
                  {ev.descricao}
                </div>
              )}
              {(ev.url || ev.tem_arquivo) && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 7 }}>
                  {ev.url && (
                    <a
                      href={ev.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        ...btnSec,
                        padding: "6px 11px",
                        fontSize: 12,
                        textDecoration: "none",
                      }}
                    >
                      <ExternalLink size={12} /> Abrir link
                    </a>
                  )}
                  {ev.tem_arquivo && (
                    <button
                      onClick={() => onVerArquivoEvid(ev.id)}
                      disabled={abrindoEvid === ev.id}
                      style={{ ...btnSec, padding: "6px 11px", fontSize: 12 }}
                    >
                      {abrindoEvid === ev.id ? (
                        <Loader2 size={12} className="spin" />
                      ) : (
                        <FileText size={12} />
                      )}{" "}
                      Ver arquivo
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {evids.length === 0 && (
          <span style={{ fontSize: 12.5, color: "#9b93b0" }}>
            Nada por aqui ainda. Adicione fotos de trabalhos, certificados ou links de projetos!
          </span>
        )}
      </div>

      {!formEvidAberto ? (
        <button onClick={() => setFormEvidAberto(true)} style={{ ...btnSec, marginBottom: 20 }}>
          <Plus size={13} /> Adicionar prova ou certificado
        </button>
      ) : (
        <div
          style={{
            border: `1.5px solid ${BORDA}`,
            borderRadius: 12,
            padding: 14,
            marginBottom: 20,
            background: "#FBFAFE",
          }}
        >
          <div style={{ fontSize: 13, fontWeight: 800, color: ROXO_DARK, marginBottom: 10 }}>
            Nova prova ou certificado
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            <label>
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: CINZA,
                  display: "block",
                  marginBottom: 4,
                }}
              >
                Tipo
              </span>
              <select value={evTipo} onChange={(e) => setEvTipo(e.target.value)} style={inputStyle}>
                {Object.entries(TIPO_EVID_LABEL).map(([valor, rotulo]) => (
                  <option key={valor} value={valor}>
                    {rotulo}
                  </option>
                ))}
              </select>
            </label>
            <input
              style={inputStyle}
              placeholder="Dê um nome. Ex.: Certificado de curso de vendas"
              value={evTitulo}
              onChange={(e) => setEvTitulo(e.target.value)}
            />
            <textarea
              style={{ ...inputStyle, minHeight: 60, resize: "vertical" }}
              placeholder="Conte rapidinho o que é (opcional)"
              value={evDescricao}
              onChange={(e) => setEvDescricao(e.target.value)}
            />
            <label>
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: 600,
                  color: CINZA,
                  display: "block",
                  marginBottom: 4,
                }}
              >
                Link (se estiver na internet)
              </span>
              <input
                style={{ ...inputStyle, opacity: evArquivo ? 0.5 : 1 }}
                type="url"
                inputMode="url"
                placeholder="https://..."
                value={evUrl}
                disabled={!!evArquivo}
                onChange={(e) => setEvUrl(e.target.value)}
              />
            </label>
            {podeArquivo && (
              <label style={{ opacity: evUrl.trim() ? 0.5 : 1 }}>
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 600,
                    color: CINZA,
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Ou envie um arquivo (PDF ou foto, até {EVID_MAX_MB} MB)
                </span>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                  disabled={!!evUrl.trim()}
                  onChange={(e) => onEscolherArquivoEvid(e.target.files?.[0] ?? null)}
                  style={{ ...inputStyle, padding: "8px 10px", cursor: "pointer" }}
                />
                {evArquivo && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12,
                      color: ROXO_DARK,
                      marginTop: 6,
                    }}
                  >
                    {evArquivo.name} ({fmtSize(evArquivo.size)})
                    <button
                      onClick={() => setEvArquivo(null)}
                      title="Remover arquivo"
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        color: "#9b93b0",
                        display: "flex",
                        padding: 0,
                      }}
                    >
                      <X size={12} />
                    </button>
                  </span>
                )}
              </label>
            )}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button
              onClick={onSalvarEvid}
              disabled={!evTitulo.trim() || salvandoEvid}
              style={btnPri(!!evTitulo.trim() && !salvandoEvid)}
            >
              {salvandoEvid ? <Loader2 size={14} className="spin" /> : <Save size={14} />} Salvar
            </button>
            <button onClick={limparFormEvid} style={btnSec}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ===== Preferências ===== */}
      <SubTitulo icon={Star} cor={VERDE}>
        Minhas preferências
      </SubTitulo>
      <div style={{ display: "grid", gap: 12, marginBottom: 12 }}>
        <label>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: ROXO_DARK,
              display: "block",
              marginBottom: 5,
            }}
          >
            Disponibilidade de horário
          </span>
          <input
            style={inputStyle}
            placeholder="Ex.: manhã e tarde, fins de semana..."
            value={disponibilidade}
            onChange={(e) => setDisponibilidade(e.target.value)}
          />
        </label>
        <div>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: ROXO_DARK,
              display: "block",
              marginBottom: 5,
            }}
          >
            Quanto você gostaria de ganhar (R$)
          </span>
          <div style={{ display: "flex", gap: 10 }}>
            <input
              style={inputStyle}
              type="number"
              inputMode="decimal"
              min={0}
              placeholder="De"
              value={preMin}
              onChange={(e) => setPreMin(e.target.value)}
            />
            <input
              style={inputStyle}
              type="number"
              inputMode="decimal"
              min={0}
              placeholder="Até"
              value={preMax}
              onChange={(e) => setPreMax(e.target.value)}
            />
          </div>
        </div>
        <div>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: ROXO_DARK,
              display: "block",
              marginBottom: 5,
            }}
          >
            Como você prefere trabalhar
          </span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
            {MODELOS.map((m) => (
              <button
                key={m.valor}
                type="button"
                onClick={() => setModelo(modelo === m.valor ? "" : m.valor)}
                style={{
                  padding: "8px 13px",
                  borderRadius: 99,
                  fontSize: 12.5,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  border: `1.5px solid ${modelo === m.valor ? ROXO : BORDA}`,
                  background: modelo === m.valor ? ROXO_TINT : "#fff",
                  color: modelo === m.valor ? ROXO_DARK : CINZA,
                  fontWeight: modelo === m.valor ? 700 : 500,
                }}
              >
                {m.rotulo}
              </button>
            ))}
          </div>
        </div>
        <div>
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: ROXO_DARK,
              display: "block",
              marginBottom: 5,
            }}
          >
            Áreas que me interessam
          </span>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              marginBottom: interesses.length ? 8 : 0,
            }}
          >
            {interesses.map((i) => (
              <span
                key={i}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  fontSize: 12,
                  fontWeight: 600,
                  color: ROXO_DARK,
                  background: ROXO_TINT,
                  padding: "5px 8px 5px 11px",
                  borderRadius: 99,
                }}
              >
                {i}
                <button
                  onClick={() => setInteresses((p) => p.filter((x) => x !== i))}
                  title="Remover"
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#9b93b0",
                    display: "flex",
                    padding: 0,
                  }}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              style={inputStyle}
              placeholder="Ex.: vendas, atendimento, estoque..."
              value={novoInteresse}
              onChange={(e) => setNovoInteresse(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addInteresse();
                }
              }}
            />
            <button
              onClick={addInteresse}
              disabled={!novoInteresse.trim()}
              style={{ ...btnSec, opacity: novoInteresse.trim() ? 1 : 0.5, flexShrink: 0 }}
            >
              <Plus size={13} />
            </button>
          </div>
        </div>
      </div>
      {msgPrefs && (
        <div
          style={{
            fontSize: 12.5,
            borderRadius: 10,
            padding: 10,
            marginBottom: 10,
            color: msgPrefs.tipo === "ok" ? VERDE : "#B91C1C",
            background: msgPrefs.tipo === "ok" ? "#F0FDF4" : "#FEF2F2",
            border: `1px solid ${msgPrefs.tipo === "ok" ? "#BBF7D0" : "#FECACA"}`,
          }}
        >
          {msgPrefs.texto}
        </div>
      )}
      <button onClick={onSalvarPrefs} disabled={salvandoPrefs} style={btnPri(!salvandoPrefs)}>
        {salvandoPrefs ? <Loader2 size={14} className="spin" /> : <Save size={14} />} Salvar
        preferências
      </button>
    </div>
  );
}
