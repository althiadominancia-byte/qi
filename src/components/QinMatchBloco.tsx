import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Target, Sparkles, Loader2, CheckCircle2, AlertTriangle, HelpCircle } from "lucide-react";
import { getMatch, calcularMatch } from "@/lib/qinmatch.functions";
import { ROXO, ROXO_DARK, ROXO_TINT, LARANJA, CINZA, BORDA, VERDE, VERMELHO, AMARELO } from "@/lib/recrutamento/data";

const DIM_LABEL: Record<string, string> = {
  competencias: "Competências", comportamental: "Comportamental",
  evidencias: "Evidências", potencial: "Potencial", condicoes: "Condições",
};
const ORDEM = ["competencias", "comportamental", "evidencias", "potencial", "condicoes"];

function corScore(n: number) { return n >= 75 ? VERDE : n >= 50 ? AMARELO : VERMELHO; }

export function QinMatchBloco({ candidatoId, vagaId }: { candidatoId: string; vagaId: string | null }) {
  const qc = useQueryClient();
  const fetchMatch = useServerFn(getMatch);
  const calcular = useServerFn(calcularMatch);
  const matchQ = useQuery({
    queryKey: ["qinmatch", candidatoId, vagaId],
    queryFn: () => fetchMatch({ data: { candidatoId, vagaId: vagaId! } }) as Promise<any>,
    enabled: !!vagaId,
  });
  const [calc, setCalc] = useState(false);

  if (!vagaId) return null; // sem vaga vinculada, não há match

  const m = matchQ.data;
  async function recalcular() {
    setCalc(true);
    try { await calcular({ data: { candidatoId, vagaId: vagaId! } }); qc.invalidateQueries({ queryKey: ["qinmatch", candidatoId, vagaId] }); }
    catch (e: any) { alert(e?.message || "Falha ao calcular o match."); }
    finally { setCalc(false); }
  }

  return (
    <div style={{ border: `1px solid ${BORDA}`, borderRadius: 16, padding: 18, marginBottom: 16, background: "#fff" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <Target size={18} color={ROXO} />
        <span className="h" style={{ fontWeight: 800, fontSize: 15, color: ROXO_DARK, flex: 1 }}>QinMatch — compatibilidade</span>
        <button onClick={recalcular} disabled={calc} style={{
          display: "flex", alignItems: "center", gap: 6, background: calc ? "#D8D2E6" : ROXO, color: "#fff", border: "none",
          padding: "7px 13px", borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: calc ? "wait" : "pointer", fontFamily: "inherit",
        }}>
          {calc ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />} {m ? "Recalcular" : "Calcular"}
        </button>
      </div>

      {matchQ.isLoading ? (
        <div style={{ fontSize: 13, color: CINZA }}>Carregando…</div>
      ) : !m ? (
        <div style={{ fontSize: 12.8, color: "#9b93b0" }}>Ainda não calculado — clique em "Calcular" para gerar a compatibilidade explicável.</div>
      ) : (
        <>
          {/* Score geral */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
              <span className="h" style={{ fontSize: 40, fontWeight: 800, color: corScore(m.score_geral) }}>{m.score_geral}</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: CINZA }}>%</span>
            </div>
            <div style={{ flex: 1, minWidth: 180, display: "grid", gap: 7 }}>
              {ORDEM.filter((k) => m.dimensoes?.[k] != null).map((k) => {
                const v = m.dimensoes[k] as number;
                return (
                  <div key={k} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <span style={{ fontSize: 11.5, color: ROXO_DARK, width: 108, flexShrink: 0 }}>{DIM_LABEL[k]}</span>
                    <div style={{ flex: 1, height: 7, background: "#EEE9F6", borderRadius: 99, overflow: "hidden" }}>
                      <div style={{ width: `${v}%`, height: "100%", background: corScore(v) }} />
                    </div>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: ROXO_DARK, width: 30, textAlign: "right" }}>{v}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Explicação */}
          <div style={{ display: "grid", gap: 10 }}>
            <Explica icon={CheckCircle2} cor={VERDE} titulo="Pontos fortes" itens={m.explicacao?.pontos_fortes} vazio="—" />
            <Explica icon={AlertTriangle} cor={LARANJA} titulo="Lacunas desenvolvíveis" itens={m.explicacao?.lacunas} vazio="Nenhuma lacuna essencial." />
            <Explica icon={HelpCircle} cor={ROXO} titulo="A validar (sem evidência)" itens={m.explicacao?.o_que_validar} vazio="Tudo com evidência." />
          </div>

          <div style={{ marginTop: 14, background: ROXO_TINT, borderRadius: 10, padding: 11, fontSize: 11.5, color: ROXO_DARK, lineHeight: 1.5 }}>
            Apoio à decisão — a recomendação organiza os dados e explica os critérios; a <strong>decisão é sempre humana</strong>.
            {m.versao_algoritmo ? <span style={{ color: "#9b93b0" }}> ({m.versao_algoritmo})</span> : null}
          </div>
        </>
      )}
    </div>
  );
}

function Explica({ icon: Ic, cor, titulo, itens, vazio }: { icon: any; cor: string; titulo: string; itens?: string[]; vazio: string }) {
  const lista = itens ?? [];
  return (
    <div style={{ display: "flex", gap: 9, alignItems: "flex-start" }}>
      <Ic size={15} color={cor} style={{ flexShrink: 0, marginTop: 2 }} />
      <div>
        <div style={{ fontSize: 12, fontWeight: 700, color: ROXO_DARK }}>{titulo}</div>
        {lista.length ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
            {lista.map((x, i) => <span key={i} style={{ fontSize: 11.5, color: ROXO_DARK, background: cor + "12", border: `1px solid ${cor}33`, padding: "3px 9px", borderRadius: 99 }}>{x}</span>)}
          </div>
        ) : <div style={{ fontSize: 11.5, color: "#9b93b0", marginTop: 2 }}>{vazio}</div>}
      </div>
    </div>
  );
}
