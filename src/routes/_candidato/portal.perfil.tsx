import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ChevronLeft,
  Sparkles,
  Save,
  Loader2,
  Star,
  Briefcase,
  Heart,
  X,
  Plus,
  CheckCircle2,
  FileText,
  Upload,
  Download,
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
  enviarMeuCurriculoConta,
  urlMeuCurriculoConta,
  removerMeuCurriculoConta,
  gerarMeuCurriculo,
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

// /portal/perfil — Cadastro Neutro: o perfil é da PESSOA, vale para todas as
// vagas. Perguntas abertas → IA organiza (taxonomia + validação de experiências).

export const Route = createFileRoute("/_candidato/portal/perfil")({
  head: () => ({ meta: [{ title: "Meu perfil — Portal do Candidato" }] }),
  component: MeuPerfilPage,
});

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

function TituloSecao({ icon: Icon, children }: any) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 12 }}>
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
      <h2 className="h" style={{ fontSize: 17, fontWeight: 800, margin: 0, color: ROXO_DARK }}>
        {children}
      </h2>
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
  const salvarPrefs = useServerFn(salvarPreferenciasConta);
  const enviarCv = useServerFn(enviarMeuCurriculoConta);
  const urlCv = useServerFn(urlMeuCurriculoConta);
  const removerCv = useServerFn(removerMeuCurriculoConta);
  const gerarCv = useServerFn(gerarMeuCurriculo);

  const perfilQ = useQuery({
    queryKey: ["meu-perfil"],
    queryFn: () => fetchPerfil() as Promise<any>,
    retry: false,
  });
  const d = perfilQ.data;

  // Respostas abertas
  const [respostas, setRespostas] = useState<Record<string, string>>({});
  const [salvandoResp, setSalvandoResp] = useState(false);
  const [organizando, setOrganizando] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);

  // Experiência (form)
  const [expAberta, setExpAberta] = useState(false);
  const [expEdit, setExpEdit] = useState<any>({
    tipo: "formal",
    titulo: "",
    organizacao: "",
    descricao: "",
    atual: false,
  });
  const [salvandoExp, setSalvandoExp] = useState(false);

  // Preferências
  const [prefs, setPrefs] = useState<any>({
    disponibilidade: "",
    pretensao_min: "",
    pretensao_max: "",
    modelo_trabalho: null,
    interesses: [],
  });
  const [novoInteresse, setNovoInteresse] = useState("");
  const [enviandoCv, setEnviandoCv] = useState(false);
  const [gerandoCv, setGerandoCv] = useState(false);
  const [salvandoPrefs, setSalvandoPrefs] = useState(false);

  useEffect(() => {
    if (d?.respostas) setRespostas({ ...d.respostas });
    if (d?.preferencias) {
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

  async function onSalvarRespostas() {
    setSalvandoResp(true);
    setMsg(null);
    try {
      await salvarResp({ data: { respostas } as any });
      setMsg({ tipo: "ok", texto: "Respostas salvas!" });
      await invalidar();
    } catch (e: any) {
      setMsg({ tipo: "erro", texto: e?.message || "Não foi possível salvar." });
    } finally {
      setSalvandoResp(false);
    }
  }

  async function onOrganizar() {
    setOrganizando(true);
    setMsg(null);
    try {
      await salvarResp({ data: { respostas } as any });
      const r: any = await estruturar();
      setMsg({
        tipo: "ok",
        texto: `Perfil organizado! ${r?.competencias ?? 0} habilidade(s) e ${r?.experiencias ?? 0} experiência(s) identificadas.`,
      });
      await invalidar();
    } catch (e: any) {
      setMsg({ tipo: "erro", texto: e?.message || "Não foi possível organizar agora." });
    } finally {
      setOrganizando(false);
    }
  }

  async function onSalvarExp() {
    if (salvandoExp || !expEdit.titulo?.trim()) return;
    setSalvandoExp(true);
    try {
      await salvarExp({
        data: {
          id: expEdit.id,
          tipo: expEdit.tipo,
          titulo: expEdit.titulo.trim(),
          organizacao: expEdit.organizacao || null,
          inicio: expEdit.inicio || null,
          fim: expEdit.fim || null,
          atual: !!expEdit.atual,
          descricao: expEdit.descricao || null,
        } as any,
      });
      setExpAberta(false);
      setExpEdit({ tipo: "formal", titulo: "", organizacao: "", descricao: "", atual: false });
      await invalidar();
    } catch (e: any) {
      setMsg({ tipo: "erro", texto: e?.message || "Não foi possível salvar a experiência." });
    } finally {
      setSalvandoExp(false);
    }
  }

  async function onSalvarPrefs() {
    setSalvandoPrefs(true);
    try {
      await salvarPrefs({
        data: {
          disponibilidade: prefs.disponibilidade || null,
          pretensao_min: prefs.pretensao_min === "" ? null : Number(prefs.pretensao_min),
          pretensao_max: prefs.pretensao_max === "" ? null : Number(prefs.pretensao_max),
          modelo_trabalho: prefs.modelo_trabalho,
          interesses: prefs.interesses,
        } as any,
      });
      setMsg({ tipo: "ok", texto: "Preferências salvas!" });
      await invalidar();
    } catch (e: any) {
      setMsg({ tipo: "erro", texto: e?.message || "Não foi possível salvar as preferências." });
    } finally {
      setSalvandoPrefs(false);
    }
  }

  async function onEnviarCvConta(file: File) {
    setEnviandoCv(true);
    setMsg(null);
    try {
      const ext = (file.name.split(".").pop() || "pdf").toLowerCase();
      const okTipos = ["pdf", "jpg", "jpeg", "png", "webp", "docx"];
      if (!okTipos.includes(ext)) throw new Error("Envie PDF, imagem (JPG/PNG/WEBP) ou DOCX.");
      if (file.size > 8 * 1024 * 1024) throw new Error("Arquivo grande demais (limite 8 MB).");
      // conta.id = auth user id — o path exigido pela policy é conta/<meu-id>/...
      const { data: u } = await supabase.auth.getUser();
      if (!u?.user?.id) throw new Error("Sessão expirada — entre de novo.");
      const path = `conta/${u.user.id}/cv-${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("curriculos")
        .upload(path, file, { contentType: file.type || undefined });
      if (upErr) throw new Error("Falha no envio: " + upErr.message);
      await enviarCv({ data: { storagePath: path, nomeArquivo: file.name } });
      // Estrutura o perfil com o CV novo (o "formulário" nasce preenchido).
      const r: any = await estruturar().catch(() => null);
      setMsg({
        tipo: "ok",
        texto: r
          ? "Currículo enviado — preenchemos seu perfil com ele. Confira e ajuste!"
          : "Currículo enviado! Clique em 'Organizar meu perfil com IA' para preencher seu perfil.",
      });
      await invalidar();
    } catch (e: any) {
      setMsg({ tipo: "erro", texto: e?.message || "Não foi possível enviar o currículo." });
    } finally {
      setEnviandoCv(false);
    }
  }

  async function onGerarCv() {
    setGerandoCv(true);
    setMsg(null);
    try {
      await gerarCv();
      navigate({ to: "/portal/curriculo" as any });
    } catch (e: any) {
      setMsg({ tipo: "erro", texto: e?.message || "Não foi possível criar o currículo." });
      setGerandoCv(false);
    }
  }

  if (perfilQ.isLoading) {
    return (
      <div style={{ padding: 60, textAlign: "center", color: CINZA }}>
        <Loader2 size={22} className="spin" /> Carregando seu perfil...
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "18px 16px 60px" }}>
      <button
        onClick={() => navigate({ to: "/portal" as any })}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 5,
          background: "none",
          border: "none",
          color: CINZA,
          fontSize: 13,
          fontWeight: 600,
          cursor: "pointer",
          fontFamily: "inherit",
          padding: "8px 0",
        }}
      >
        <ChevronLeft size={16} /> Minhas candidaturas
      </button>

      <h1
        className="h"
        style={{ fontSize: 24, fontWeight: 800, margin: "6px 0 4px", color: ROXO_DARK }}
      >
        Meu perfil
      </h1>
      <p style={{ color: CINZA, fontSize: 13.5, margin: "0 0 18px", lineHeight: 1.55 }}>
        Este perfil é <strong>seu</strong> — vale para todas as vagas. Conte sua história que a
        gente organiza.
      </p>

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

      {/* 1. Minha história */}
      <Card>
        <TituloSecao icon={Heart}>Minha história</TituloSecao>
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
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <button
            onClick={onSalvarRespostas}
            disabled={salvandoResp || organizando}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              background: "#fff",
              color: ROXO,
              border: `1.5px solid ${BORDA}`,
              padding: "11px 16px",
              borderRadius: 12,
              fontSize: 13.5,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
              minHeight: 44,
            }}
          >
            {salvandoResp ? <Loader2 size={15} className="spin" /> : <Save size={15} />} Salvar
            respostas
          </button>
          <button
            onClick={onOrganizar}
            disabled={organizando || salvandoResp}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              background: organizando ? "#D8D2E6" : ROXO,
              color: "#fff",
              border: "none",
              padding: "11px 18px",
              borderRadius: 12,
              fontSize: 13.5,
              fontWeight: 700,
              cursor: organizando ? "wait" : "pointer",
              fontFamily: "inherit",
              minHeight: 44,
            }}
          >
            {organizando ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />}{" "}
            {organizando
              ? "Organizando seu perfil... uns 20 segundos"
              : "Organizar meu perfil com IA"}
          </button>
        </div>
      </Card>

      {/* Meu currículo — dois caminhos: enviar o que tem OU criar do zero */}
      <Card>
        <TituloSecao icon={FileText}>Meu currículo</TituloSecao>
        {d?.cv?.tem_arquivo ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 10,
              marginBottom: 10,
            }}
          >
            <span style={{ fontSize: 13, color: ROXO_DARK, fontWeight: 600, flex: "1 1 160px" }}>
              📄 {d.cv.nome_arquivo ?? "currículo enviado"}
            </span>
            <button
              onClick={() =>
                urlCv()
                  .then((r: any) => window.open(r.url, "_blank", "noopener"))
                  .catch(() => {})
              }
              style={{
                background: "#fff",
                color: ROXO,
                border: `1.5px solid ${BORDA}`,
                padding: "8px 12px",
                borderRadius: 10,
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Download size={13} /> Baixar
            </button>
            <button
              onClick={() => {
                if (window.confirm("Remover seu currículo enviado?")) removerCv().then(invalidar);
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
              remover
            </button>
          </div>
        ) : (
          <p style={{ fontSize: 13, color: CINZA, margin: "0 0 12px", lineHeight: 1.55 }}>
            Tem currículo pronto? Envie que a gente preenche seu perfil. Não tem? Sem problema —
            criamos um para você a partir do seu perfil.
          </p>
        )}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              background: "#fff",
              color: ROXO,
              border: `1.5px solid ${BORDA}`,
              padding: "11px 16px",
              borderRadius: 12,
              fontSize: 13,
              fontWeight: 700,
              cursor: enviandoCv ? "wait" : "pointer",
              fontFamily: "inherit",
              minHeight: 44,
            }}
          >
            {enviandoCv ? <Loader2 size={15} className="spin" /> : <Upload size={15} />}
            {enviandoCv
              ? "Lendo e preenchendo seu perfil..."
              : d?.cv?.tem_arquivo
                ? "Substituir currículo"
                : "Já tenho — enviar arquivo"}
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.docx"
              style={{ display: "none" }}
              disabled={enviandoCv}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) onEnviarCvConta(f);
                e.target.value = "";
              }}
            />
          </label>
          <button
            onClick={onGerarCv}
            disabled={gerandoCv || enviandoCv}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              background: gerandoCv ? "#D8D2E6" : ROXO,
              color: "#fff",
              border: "none",
              padding: "11px 16px",
              borderRadius: 12,
              fontSize: 13,
              fontWeight: 700,
              cursor: gerandoCv ? "wait" : "pointer",
              fontFamily: "inherit",
              minHeight: 44,
            }}
          >
            {gerandoCv ? <Loader2 size={15} className="spin" /> : <Sparkles size={15} />}
            {d?.cv?.tem_gerado ? "Ver/atualizar meu currículo" : "Não tenho — criar meu currículo"}
          </button>
        </div>
        <p style={{ fontSize: 11.5, color: "#9b93b0", margin: "10px 0 0", lineHeight: 1.5 }}>
          Seu formulário é o próprio perfil abaixo — corrija e personalize à vontade; o currículo
          criado sempre reflete ele.
        </p>
      </Card>

      {/* 2. Resumo */}
      {d?.resumo_ia && (
        <Card>
          <TituloSecao icon={CheckCircle2}>Resumo</TituloSecao>
          <p style={{ fontSize: 13.5, color: ROXO_DARK, lineHeight: 1.6, margin: 0 }}>
            {d.resumo_ia}
          </p>
          {d.estruturado_em && (
            <p style={{ fontSize: 11.5, color: "#9b93b0", margin: "8px 0 0" }}>
              organizado em {fmtData(d.estruturado_em)}
            </p>
          )}
        </Card>
      )}

      {/* 3. O que eu sei fazer */}
      <Card>
        <TituloSecao icon={Star}>O que eu sei fazer</TituloSecao>
        {(d?.competencias ?? []).length === 0 && (
          <p style={{ fontSize: 13, color: CINZA, margin: 0 }}>
            Nada por aqui ainda — responda as perguntas acima e clique em "Organizar meu perfil com
            IA".
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
                title="Remover"
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

      {/* 4. Minhas experiências */}
      <Card>
        <TituloSecao icon={Briefcase}>Minhas experiências</TituloSecao>
        {(d?.experiencias ?? []).length === 0 && (
          <p style={{ fontSize: 13, color: CINZA, margin: "0 0 10px" }}>
            Nenhuma ainda. Vale contar trabalho informal, bico, projeto e curso!
          </p>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {(d?.experiencias ?? []).map((e: any) => {
            const selo = SELO_VALIDACAO[e.status_validacao] ?? SELO_VALIDACAO.declarada;
            return (
              <div
                key={e.id}
                style={{ border: `1px solid ${BORDA}`, borderRadius: 12, padding: "11px 13px" }}
              >
                <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                  <span
                    style={{ fontSize: 14, fontWeight: 700, color: ROXO_DARK, flex: "1 1 160px" }}
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
                    title="Remover"
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
                {e.descricao && (
                  <div style={{ fontSize: 12.5, color: CINZA, marginTop: 6, lineHeight: 1.5 }}>
                    {e.descricao}
                  </div>
                )}
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
          <div style={{ marginTop: 12, borderTop: `1px solid ${BORDA}`, paddingTop: 12 }}>
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
              placeholder="O que você fazia? (ex.: Vendedora, Ajudante de obra...)"
              value={expEdit.titulo}
              onChange={(e) => setExpEdit((x: any) => ({ ...x, titulo: e.target.value }))}
            />
            <input
              style={{ ...inputStyle, marginBottom: 8 }}
              placeholder="Onde? (empresa, pessoa, projeto...)"
              value={expEdit.organizacao ?? ""}
              onChange={(e) => setExpEdit((x: any) => ({ ...x, organizacao: e.target.value }))}
            />
            <textarea
              style={{ ...inputStyle, resize: "vertical", marginBottom: 8 }}
              rows={2}
              placeholder="Conte um pouco (opcional)"
              value={expEdit.descricao ?? ""}
              onChange={(e) => setExpEdit((x: any) => ({ ...x, descricao: e.target.value }))}
            />
            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={onSalvarExp}
                disabled={salvandoExp || !expEdit.titulo?.trim()}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  background: expEdit.titulo?.trim() ? ROXO : "#D8D2E6",
                  color: "#fff",
                  border: "none",
                  padding: "10px 16px",
                  borderRadius: 11,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                {salvandoExp ? <Loader2 size={14} className="spin" /> : <Save size={14} />} Salvar
              </button>
              <button
                onClick={() => setExpAberta(false)}
                style={{
                  background: "none",
                  border: "none",
                  color: CINZA,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setExpAberta(true)}
            style={{
              marginTop: 12,
              display: "inline-flex",
              alignItems: "center",
              gap: 7,
              background: "#fff",
              color: ROXO,
              border: `1.5px solid ${BORDA}`,
              padding: "10px 15px",
              borderRadius: 11,
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <Plus size={15} /> Adicionar experiência
          </button>
        )}
      </Card>

      {/* 5. Minhas preferências */}
      <Card>
        <TituloSecao icon={Heart}>Minhas preferências</TituloSecao>
        <label style={{ display: "block", marginBottom: 10 }}>
          <span
            style={{
              display: "block",
              fontSize: 13,
              fontWeight: 700,
              color: ROXO_DARK,
              marginBottom: 5,
            }}
          >
            Disponibilidade de horário
          </span>
          <input
            style={inputStyle}
            placeholder="Ex.: manhã e tarde, fins de semana..."
            value={prefs.disponibilidade}
            onChange={(e) => setPrefs((p: any) => ({ ...p, disponibilidade: e.target.value }))}
          />
        </label>
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
                onClick={() => setPrefs((p: any) => ({ ...p, modelo_trabalho: on ? null : valor }))}
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
          {prefs.interesses.map((tag: string) => (
            <span
              key={tag}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                fontSize: 12.5,
                fontWeight: 600,
                color: ROXO_DARK,
                background: ROXO_TINT,
                padding: "5px 10px",
                borderRadius: 99,
              }}
            >
              {tag}
              <button
                onClick={() =>
                  setPrefs((p: any) => ({
                    ...p,
                    interesses: p.interesses.filter((t: string) => t !== tag),
                  }))
                }
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 0,
                  color: ROXO,
                }}
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 14 }}>
          <input
            style={{ ...inputStyle, flex: 1 }}
            placeholder="Ex.: vendas, atendimento, estoque..."
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
        <button
          onClick={onSalvarPrefs}
          disabled={salvandoPrefs}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            background: ROXO,
            color: "#fff",
            border: "none",
            padding: "11px 18px",
            borderRadius: 12,
            fontSize: 13.5,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "inherit",
            minHeight: 44,
          }}
        >
          {salvandoPrefs ? <Loader2 size={15} className="spin" /> : <Save size={15} />} Salvar
          preferências
        </button>
      </Card>
    </div>
  );
}

function fmtData(iso?: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleDateString("pt-BR");
  } catch {
    return "";
  }
}
