import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Video, Loader2, Copy, Check, ThumbsUp, ThumbsDown } from "lucide-react";
import { getMyScope } from "@/lib/scope.functions";
import { useFeatures } from "@/lib/recrutamento/use-features";
import { agendarEntrevista, getEntrevistaDoCandidato, registrarDecisaoEntrevista } from "@/lib/entrevista.functions";
import { ROXO, ROXO_DARK, ROXO_TINT, LARANJA, CINZA, BORDA, VERDE, VERMELHO } from "@/lib/recrutamento/data";

/**
 * Ponto de entrada da entrevista por vídeo com IA. Só aparece quando a empresa
 * tem o entitlement `entrevista_ia` E o usuário tem a permissão
 * `conduzir_entrevistas` — a estrutura de acesso do módulo. A sala LiveKit e a
 * análise entram nas fases seguintes; aqui já cria a entrevista, gera o link do
 * candidato e registra a DECISÃO HUMANA.
 */
export function EntrevistaBloco({ candidatoId, etapa }: { candidatoId: string; etapa: string }) {
  const qc = useQueryClient();
  const fetchScope = useServerFn(getMyScope);
  const scopeQ = useQuery({ queryKey: ["my-scope"], queryFn: () => fetchScope() });
  const { has } = useFeatures();
  const podePerm = scopeQ.data?.role === "super_admin" || !!scopeQ.data?.perms?.conduzir_entrevistas;

  const fetchEnt = useServerFn(getEntrevistaDoCandidato);
  const agendar = useServerFn(agendarEntrevista);
  const decidir = useServerFn(registrarDecisaoEntrevista);
  const entQ = useQuery({
    queryKey: ["entrevista", candidatoId],
    queryFn: () => fetchEnt({ data: { candidatoId } }) as Promise<any>,
    enabled: has("entrevista_ia") && podePerm,
  });

  const [criando, setCriando] = useState(false);
  const [copiado, setCopiado] = useState(false);

  // Gate da estrutura de acesso: entitlement + permissão. Só na etapa de entrevista/contratado.
  if (!has("entrevista_ia") || !podePerm) return null;
  if (etapa !== "entrevista" && etapa !== "contratado") return null;

  const ent = entQ.data;
  const link = ent?.token ? `${typeof window !== "undefined" ? window.location.origin : ""}/e/${ent.token}` : "";

  async function criar() {
    setCriando(true);
    try { await agendar({ data: { candidatoId } }); qc.invalidateQueries({ queryKey: ["entrevista", candidatoId] }); }
    catch (e: any) { alert(e?.message || "Falha ao criar a entrevista."); }
    finally { setCriando(false); }
  }
  async function setDecisao(decisao: "avancar" | "reprovar") {
    if (!ent?.id) return;
    try { await decidir({ data: { candidatoId, entrevista_id: ent.id, decisao } }); qc.invalidateQueries({ queryKey: ["entrevista", candidatoId] }); }
    catch (e: any) { alert(e?.message); }
  }

  return (
    <div style={{ border: `1px solid ${BORDA}`, borderRadius: 16, padding: 18, marginBottom: 16, background: "#fff" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
        <Video size={18} color={ROXO} />
        <span className="h" style={{ fontWeight: 800, fontSize: 15, color: ROXO_DARK, flex: 1 }}>Entrevista por vídeo (IA)</span>
      </div>

      {!ent ? (
        <button onClick={criar} disabled={criando || entQ.isLoading} style={{
          display: "flex", alignItems: "center", gap: 7, background: criando ? "#D8D2E6" : ROXO, color: "#fff", border: "none",
          padding: "9px 15px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: criando ? "wait" : "pointer", fontFamily: "inherit",
        }}>
          {criando ? <Loader2 size={15} className="spin" /> : <Video size={15} />} Criar sala de entrevista
        </button>
      ) : (
        <div style={{ display: "grid", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, color: CINZA }}>Status:</span>
            <span style={{ fontSize: 11.5, fontWeight: 800, color: ROXO, background: ROXO_TINT, padding: "3px 10px", borderRadius: 99, textTransform: "uppercase" }}>{ent.status}</span>
            {/* Consentimento LGPD do candidato */}
            {ent.consentimento == null ? (
              <span style={{ fontSize: 11.5, fontWeight: 700, color: LARANJA }}>Aguardando consentimento</span>
            ) : ent.consentimento.consentiu ? (
              <span style={{ fontSize: 11.5, fontWeight: 700, color: VERDE }}>Consentiu a gravação</span>
            ) : (
              <span style={{ fontSize: 11.5, fontWeight: 700, color: CINZA }}>Recusou — entrevista sem gravação</span>
            )}
          </div>
          {/* Link do candidato */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: ROXO_DARK, marginBottom: 5 }}>Link do candidato</div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <code style={{ flex: "1 1 240px", fontSize: 12, background: "#FBFAFE", border: `1px solid ${BORDA}`, borderRadius: 8, padding: "8px 10px", color: ROXO_DARK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{link}</code>
              <button onClick={() => { navigator.clipboard?.writeText(link); setCopiado(true); setTimeout(() => setCopiado(false), 1500); }}
                style={{ display: "flex", alignItems: "center", gap: 5, background: "#fff", color: ROXO, border: `1.5px solid ${BORDA}`, padding: "7px 11px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
                {copiado ? <><Check size={13} color={VERDE} /> Copiado</> : <><Copy size={13} /> Copiar</>}
              </button>
            </div>
            <div style={{ fontSize: 11, color: "#9b93b0", marginTop: 6 }}>
              A sala de vídeo e a análise de conteúdo entram nas próximas fases (config do provedor LiveKit).
            </div>
          </div>
          {/* Decisão humana */}
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: ROXO_DARK, marginBottom: 6 }}>Decisão (humana)</div>
            {ent.decisao_humana ? (
              <span style={{ fontSize: 12.5, fontWeight: 700, color: ent.decisao_humana === "avancar" ? VERDE : VERMELHO }}>
                {ent.decisao_humana === "avancar" ? "Avançar" : "Reprovar"}{ent.decisao_em ? ` · ${new Date(ent.decisao_em).toLocaleDateString("pt-BR")}` : ""}
              </span>
            ) : (
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => setDecisao("avancar")} style={{ display: "flex", alignItems: "center", gap: 6, background: "#fff", color: VERDE, border: `1.5px solid ${VERDE}55`, padding: "7px 13px", borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}><ThumbsUp size={14} /> Avançar</button>
                <button onClick={() => setDecisao("reprovar")} style={{ display: "flex", alignItems: "center", gap: 6, background: "#fff", color: VERMELHO, border: `1.5px solid ${VERMELHO}55`, padding: "7px 13px", borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}><ThumbsDown size={14} /> Reprovar</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
