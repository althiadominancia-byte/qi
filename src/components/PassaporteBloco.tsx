import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Sparkles,
  Plus,
  X,
  Loader2,
  IdCard,
  Briefcase,
  Star,
  Video,
  RefreshCw,
} from "lucide-react";
import {
  getPassaporte,
  listCompetencias,
  salvarCompetenciaCandidato,
  removerCompetenciaCandidato,
  extrairPassaporte,
} from "@/lib/passaporte.functions";
import { getVideoCandidato, reprocessarVideo } from "@/lib/video.functions";
import {
  ROXO,
  ROXO_DARK,
  ROXO_TINT,
  LARANJA,
  CINZA,
  BORDA,
  VERDE,
  AMARELO,
  VERMELHO,
} from "@/lib/recrutamento/data";

const TIPO_COR: Record<string, string> = {
  tecnica: "#3B6FB0",
  comportamental: "#2E8B7A",
  transversal: "#8A5AC0",
};
const ORIGEM_LABEL: Record<string, string> = {
  ia: "IA",
  declarada: "declarada",
  avaliada: "avaliada",
};
const COMUNICACAO_COR: Record<string, string> = { forte: VERDE, media: AMARELO, fraca: VERMELHO };
const COMUNICACAO_LABEL: Record<string, string> = {
  forte: "Comunicação forte",
  media: "Comunicação média",
  fraca: "Comunicação fraca",
};

function fmtDuracao(s?: number | null) {
  if (!s && s !== 0) return null;
  const m = Math.floor(s / 60);
  const r = Math.round(s % 60);
  return `${m}:${String(r).padStart(2, "0")} min`;
}
function fmtData(iso?: string | null) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function PassaporteBloco({ candidatoId }: { candidatoId: string }) {
  const qc = useQueryClient();
  const fetchPass = useServerFn(getPassaporte);
  const fetchTax = useServerFn(listCompetencias);
  const salvarComp = useServerFn(salvarCompetenciaCandidato);
  const removerComp = useServerFn(removerCompetenciaCandidato);
  const extrair = useServerFn(extrairPassaporte);
  const fetchVideo = useServerFn(getVideoCandidato);
  const reprocessar = useServerFn(reprocessarVideo);

  const passQ = useQuery({
    queryKey: ["passaporte", candidatoId],
    queryFn: () => fetchPass({ data: { candidatoId } }) as Promise<any>,
  });
  const taxQ = useQuery({
    queryKey: ["competencias-tax"],
    queryFn: () => fetchTax() as Promise<any[]>,
  });
  const videoQ = useQuery({
    queryKey: ["video-candidato", candidatoId],
    queryFn: () => fetchVideo({ data: { candidatoId } }) as Promise<any>,
  });

  const [novaComp, setNovaComp] = useState("");
  const [nivel, setNivel] = useState(3);
  const [extraindo, setExtraindo] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [processandoVideo, setProcessandoVideo] = useState(false);
  const [videoErro, setVideoErro] = useState<string | null>(null);

  const p = passQ.data;
  const video: any = videoQ.data ?? null;
  const analise: any = video?.analise ?? null;
  const comunicacaoCor = COMUNICACAO_COR[analise?.comunicacao] ?? CINZA;
  const comps: any[] = p?.competencias ?? [];
  const exps: any[] = p?.experiencias ?? [];
  const pref = p?.preferencias ?? null;
  const jaTem = useMemo(() => new Set(comps.map((c) => c.competencia?.id)), [comps]);
  const disponiveis = (taxQ.data ?? []).filter((t) => !jaTem.has(t.id));

  const invalidate = () => qc.invalidateQueries({ queryKey: ["passaporte", candidatoId] });

  async function onExtrair() {
    setExtraindo(true);
    try {
      await extrair({ data: { candidatoId } });
      invalidate();
    } catch (e: any) {
      alert(e?.message || "Falha ao extrair passaporte.");
    } finally {
      setExtraindo(false);
    }
  }
  async function onAdd() {
    if (!novaComp || salvando) return;
    setSalvando(true);
    try {
      await salvarComp({
        data: { candidatoId, competencia_id: novaComp, nivel, origem: "declarada" },
      });
      setNovaComp("");
      setNivel(3);
      invalidate();
    } catch (e: any) {
      alert(e?.message || "Falha ao adicionar.");
    } finally {
      setSalvando(false);
    }
  }
  async function onRemove(id: string) {
    try {
      await removerComp({ data: { candidatoId, id } });
      invalidate();
    } catch (e: any) {
      alert(e?.message);
    }
  }
  async function onProcessarVideo() {
    if (processandoVideo) return;
    setProcessandoVideo(true);
    setVideoErro(null);
    try {
      await reprocessar({ data: { candidatoId } });
      qc.invalidateQueries({ queryKey: ["video-candidato", candidatoId] });
    } catch (e: any) {
      setVideoErro(e?.message || "Falha ao processar o vídeo.");
    } finally {
      setProcessandoVideo(false);
    }
  }
  function onRecarregarVideo() {
    qc.invalidateQueries({ queryKey: ["video-candidato", candidatoId] });
  }

  return (
    <div
      style={{
        border: `1px solid ${BORDA}`,
        borderRadius: 16,
        padding: 18,
        marginBottom: 16,
        background: "#fff",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          marginBottom: 14,
          flexWrap: "wrap",
        }}
      >
        <IdCard size={18} color={ROXO} />
        <span className="h" style={{ fontWeight: 800, fontSize: 15, color: ROXO_DARK, flex: 1 }}>
          Passaporte de Talentos
        </span>
        <button
          onClick={onExtrair}
          disabled={extraindo}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            background: extraindo ? "#D8D2E6" : ROXO,
            color: "#fff",
            border: "none",
            padding: "7px 13px",
            borderRadius: 9,
            fontSize: 12.5,
            fontWeight: 700,
            cursor: extraindo ? "wait" : "pointer",
            fontFamily: "inherit",
          }}
        >
          {extraindo ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />} Extrair com
          IA
        </button>
      </div>

      {passQ.isLoading ? (
        <div style={{ fontSize: 13, color: CINZA }}>Carregando…</div>
      ) : (
        <>
          {/* Competências */}
          <div style={{ fontSize: 12, fontWeight: 700, color: ROXO_DARK, marginBottom: 8 }}>
            Competências
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
            {comps.map((c) => {
              const cor = TIPO_COR[c.competencia?.tipo] ?? ROXO;
              return (
                <div
                  key={c.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                    border: `1px solid ${cor}44`,
                    background: cor + "0e",
                    borderRadius: 99,
                    padding: "5px 6px 5px 11px",
                  }}
                >
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: ROXO_DARK }}>
                    {c.competencia?.nome}
                  </span>
                  <span style={{ display: "flex", gap: 2 }}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <span
                        key={n}
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: 99,
                          background: n <= c.nivel ? cor : "#E6E1F0",
                        }}
                      />
                    ))}
                  </span>
                  {c.origem === "ia" && (
                    <span
                      style={{
                        fontSize: 9.5,
                        fontWeight: 800,
                        color: LARANJA,
                        textTransform: "uppercase",
                      }}
                    >
                      {ORIGEM_LABEL[c.origem]}
                    </span>
                  )}
                  <button
                    onClick={() => onRemove(c.id)}
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
                </div>
              );
            })}
            {comps.length === 0 && (
              <span style={{ fontSize: 12.5, color: "#9b93b0" }}>
                Nenhuma competência ainda — use "Extrair com IA" ou adicione abaixo.
              </span>
            )}
          </div>
          {/* Adicionar competência */}
          <div
            style={{
              display: "flex",
              gap: 8,
              alignItems: "center",
              flexWrap: "wrap",
              marginBottom: 16,
            }}
          >
            <select value={novaComp} onChange={(e) => setNovaComp(e.target.value)} style={sel}>
              <option value="">Adicionar competência…</option>
              {disponiveis.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nome}
                </option>
              ))}
            </select>
            <select
              value={nivel}
              onChange={(e) => setNivel(Number(e.target.value))}
              style={{ ...sel, width: "auto" }}
            >
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>
                  Nível {n}
                </option>
              ))}
            </select>
            <button
              onClick={onAdd}
              disabled={!novaComp || salvando}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                background: "#fff",
                color: ROXO,
                border: `1.5px solid ${BORDA}`,
                padding: "7px 12px",
                borderRadius: 9,
                fontSize: 12.5,
                fontWeight: 700,
                cursor: novaComp ? "pointer" : "not-allowed",
                opacity: novaComp ? 1 : 0.5,
                fontFamily: "inherit",
              }}
            >
              <Plus size={13} /> Adicionar
            </button>
          </div>

          {/* Experiências */}
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: ROXO_DARK,
              marginBottom: 8,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Briefcase size={13} color={ROXO} /> Experiências
          </div>
          <div style={{ display: "grid", gap: 7, marginBottom: 16 }}>
            {exps.map((e) => (
              <div
                key={e.id}
                style={{ border: `1px solid ${BORDA}`, borderRadius: 10, padding: "9px 12px" }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: ROXO_DARK }}>
                    {e.titulo}
                  </span>
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
                    {e.tipo}
                  </span>
                </div>
                {e.descricao && (
                  <div style={{ fontSize: 12, color: CINZA, marginTop: 3 }}>{e.descricao}</div>
                )}
              </div>
            ))}
            {exps.length === 0 && (
              <span style={{ fontSize: 12.5, color: "#9b93b0" }}>
                Sem experiências estruturadas ainda.
              </span>
            )}
          </div>

          {/* Preferências */}
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: ROXO_DARK,
              marginBottom: 8,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Star size={13} color={VERDE} /> Preferências
          </div>
          {pref ? (
            <div
              style={{
                fontSize: 12.5,
                color: ROXO_DARK,
                display: "flex",
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              {pref.modelo_trabalho && (
                <span>
                  Modelo: <strong>{pref.modelo_trabalho}</strong>
                </span>
              )}
              {pref.disponibilidade && (
                <span>
                  Disponibilidade: <strong>{pref.disponibilidade}</strong>
                </span>
              )}
              {(pref.pretensao_min || pref.pretensao_max) && (
                <span>
                  Pretensão:{" "}
                  <strong>
                    {pref.pretensao_min ?? "?"}–{pref.pretensao_max ?? "?"}
                  </strong>
                </span>
              )}
              {Array.isArray(pref.interesses) && pref.interesses.length > 0 && (
                <span>Interesses: {pref.interesses.join(", ")}</span>
              )}
            </div>
          ) : (
            <span style={{ fontSize: 12.5, color: "#9b93b0" }}>Sem preferências registradas.</span>
          )}
        </>
      )}

      {/* Vídeo de apresentação */}
      {video && (
        <div style={{ borderTop: `1px solid ${BORDA}`, marginTop: 18, paddingTop: 16 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              marginBottom: 10,
              flexWrap: "wrap",
            }}
          >
            <Video size={14} color={ROXO} />
            <span style={{ fontSize: 12, fontWeight: 700, color: ROXO_DARK, flex: 1 }}>
              Vídeo de apresentação
            </span>
            {video.processado && (
              <button
                onClick={onProcessarVideo}
                disabled={processandoVideo}
                title="Reprocessar transcrição e análise"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  background: "none",
                  border: `1px solid ${BORDA}`,
                  color: CINZA,
                  padding: "4px 10px",
                  borderRadius: 8,
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: processandoVideo ? "wait" : "pointer",
                  fontFamily: "inherit",
                }}
              >
                {processandoVideo ? (
                  <Loader2 size={12} className="spin" />
                ) : (
                  <RefreshCw size={12} />
                )}{" "}
                Reprocessar
              </button>
            )}
          </div>

          {video.url ? (
            <video
              key={video.url}
              controls
              preload="metadata"
              src={video.url}
              style={{
                width: "100%",
                maxWidth: 480,
                borderRadius: 12,
                border: `1px solid ${BORDA}`,
                background: "#000",
                display: "block",
                marginBottom: 8,
              }}
            />
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                marginBottom: 8,
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontSize: 12.5, color: "#9b93b0" }}>Link do vídeo expirado.</span>
              <button
                onClick={onRecarregarVideo}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  background: "#fff",
                  color: ROXO,
                  border: `1.5px solid ${BORDA}`,
                  padding: "5px 11px",
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
              >
                <RefreshCw size={12} /> Recarregar
              </button>
            </div>
          )}

          <div
            style={{
              fontSize: 12,
              color: CINZA,
              display: "flex",
              flexWrap: "wrap",
              gap: 12,
              marginBottom: 4,
            }}
          >
            {fmtDuracao(video.duracao_s) && (
              <span>
                Duração: <strong>{fmtDuracao(video.duracao_s)}</strong>
              </span>
            )}
            {fmtData(video.created_at) && (
              <span>
                Enviado em <strong>{fmtData(video.created_at)}</strong>
              </span>
            )}
            {video.url && (
              <button
                onClick={onRecarregarVideo}
                title="O link do vídeo expira em 5 minutos"
                style={{
                  background: "none",
                  border: "none",
                  color: ROXO,
                  fontSize: 11.5,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <RefreshCw size={11} /> recarregar
              </button>
            )}
          </div>
          {video.consentiu_em && (
            <div style={{ fontSize: 11.5, color: "#9b93b0", marginBottom: 12 }}>
              Consentimento registrado em {fmtData(video.consentiu_em)} (termo v{video.versao_termo}
              )
            </div>
          )}

          {video.processado ? (
            <>
              {analise && (
                <div
                  style={{
                    border: `1px solid ${BORDA}`,
                    background: ROXO_TINT,
                    borderRadius: 12,
                    padding: "13px 15px",
                    marginBottom: 10,
                  }}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: ROXO_DARK, marginBottom: 8 }}>
                    Análise de conteúdo
                  </div>
                  {analise.resumo && (
                    <div style={{ fontSize: 12.5, color: ROXO_DARK, marginBottom: 10 }}>
                      {analise.resumo}
                    </div>
                  )}
                  {analise.comunicacao && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flexWrap: "wrap",
                        marginBottom: 10,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 800,
                          color: "#fff",
                          background: comunicacaoCor,
                          padding: "3px 10px",
                          borderRadius: 99,
                          textTransform: "uppercase",
                          letterSpacing: 0.4,
                        }}
                      >
                        {COMUNICACAO_LABEL[analise.comunicacao] ?? analise.comunicacao}
                      </span>
                      {analise.comunicacao_justificativa && (
                        <span style={{ fontSize: 12, color: CINZA }}>
                          {analise.comunicacao_justificativa}
                        </span>
                      )}
                    </div>
                  )}
                  {Array.isArray(analise.pontos_fortes) && analise.pontos_fortes.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <div
                        style={{ fontSize: 11.5, fontWeight: 700, color: VERDE, marginBottom: 3 }}
                      >
                        Pontos fortes
                      </div>
                      <ul
                        style={{
                          margin: 0,
                          paddingLeft: 18,
                          fontSize: 12.5,
                          color: ROXO_DARK,
                          display: "grid",
                          gap: 2,
                        }}
                      >
                        {analise.pontos_fortes.map((x: string, i: number) => (
                          <li key={i}>{x}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {Array.isArray(analise.atencao) && analise.atencao.length > 0 && (
                    <div style={{ marginBottom: 8 }}>
                      <div
                        style={{ fontSize: 11.5, fontWeight: 700, color: AMARELO, marginBottom: 3 }}
                      >
                        Pontos de atenção
                      </div>
                      <ul
                        style={{
                          margin: 0,
                          paddingLeft: 18,
                          fontSize: 12.5,
                          color: ROXO_DARK,
                          display: "grid",
                          gap: 2,
                        }}
                      >
                        {analise.atencao.map((x: string, i: number) => (
                          <li key={i}>{x}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {Array.isArray(analise.perguntas_entrevista) &&
                    analise.perguntas_entrevista.length > 0 && (
                      <div style={{ marginBottom: 8 }}>
                        <div
                          style={{ fontSize: 11.5, fontWeight: 700, color: ROXO, marginBottom: 3 }}
                        >
                          Perguntas sugeridas para a entrevista
                        </div>
                        <ul
                          style={{
                            margin: 0,
                            paddingLeft: 18,
                            fontSize: 12.5,
                            color: ROXO_DARK,
                            display: "grid",
                            gap: 2,
                          }}
                        >
                          {analise.perguntas_entrevista.map((x: string, i: number) => (
                            <li key={i}>{x}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  <div style={{ fontSize: 11.5, color: CINZA, fontStyle: "italic" }}>
                    Análise apenas do conteúdo falado — apoio à decisão humana, não elimina
                    candidatos.
                  </div>
                </div>
              )}
              {video.transcricao && (
                <details style={{ marginBottom: 4 }}>
                  <summary
                    style={{ fontSize: 12, fontWeight: 700, color: ROXO, cursor: "pointer" }}
                  >
                    Ver transcrição
                  </summary>
                  <div
                    style={{
                      fontSize: 12.5,
                      color: CINZA,
                      whiteSpace: "pre-wrap",
                      marginTop: 6,
                      border: `1px solid ${BORDA}`,
                      borderRadius: 10,
                      padding: "10px 12px",
                    }}
                  >
                    {video.transcricao}
                  </div>
                </details>
              )}
            </>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <span style={{ fontSize: 12.5, color: "#9b93b0" }}>Vídeo ainda não transcrito.</span>
              <button
                onClick={onProcessarVideo}
                disabled={processandoVideo}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: processandoVideo ? "#D8D2E6" : ROXO,
                  color: "#fff",
                  border: "none",
                  padding: "7px 13px",
                  borderRadius: 9,
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: processandoVideo ? "wait" : "pointer",
                  fontFamily: "inherit",
                }}
              >
                {processandoVideo ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />}{" "}
                Processar análise
              </button>
            </div>
          )}
          {videoErro && (
            <div
              style={{
                fontSize: 12,
                color: VERMELHO,
                marginTop: 8,
                border: `1px solid ${VERMELHO}44`,
                background: `${VERMELHO}0d`,
                borderRadius: 9,
                padding: "8px 11px",
              }}
            >
              {videoErro}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const sel: React.CSSProperties = {
  flex: "1 1 200px",
  padding: "8px 11px",
  border: `1.5px solid ${BORDA}`,
  borderRadius: 9,
  fontSize: 13,
  fontFamily: "inherit",
  color: ROXO_DARK,
  background: "#fff",
};
