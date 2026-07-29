import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles, Plus, X, Loader2, IdCard, Briefcase, Star } from "lucide-react";
import {
  getPassaporte, listCompetencias, salvarCompetenciaCandidato,
  removerCompetenciaCandidato, extrairPassaporte,
} from "@/lib/passaporte.functions";
import { ROXO, ROXO_DARK, ROXO_TINT, LARANJA, CINZA, BORDA, VERDE } from "@/lib/recrutamento/data";

const TIPO_COR: Record<string, string> = { tecnica: "#3B6FB0", comportamental: "#2E8B7A", transversal: "#8A5AC0" };
const ORIGEM_LABEL: Record<string, string> = { ia: "IA", declarada: "declarada", avaliada: "avaliada" };

export function PassaporteBloco({ candidatoId }: { candidatoId: string }) {
  const qc = useQueryClient();
  const fetchPass = useServerFn(getPassaporte);
  const fetchTax = useServerFn(listCompetencias);
  const salvarComp = useServerFn(salvarCompetenciaCandidato);
  const removerComp = useServerFn(removerCompetenciaCandidato);
  const extrair = useServerFn(extrairPassaporte);

  const passQ = useQuery({ queryKey: ["passaporte", candidatoId], queryFn: () => fetchPass({ data: { candidatoId } }) as Promise<any> });
  const taxQ = useQuery({ queryKey: ["competencias-tax"], queryFn: () => fetchTax() as Promise<any[]> });

  const [novaComp, setNovaComp] = useState("");
  const [nivel, setNivel] = useState(3);
  const [extraindo, setExtraindo] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const p = passQ.data;
  const comps: any[] = p?.competencias ?? [];
  const exps: any[] = p?.experiencias ?? [];
  const pref = p?.preferencias ?? null;
  const jaTem = useMemo(() => new Set(comps.map((c) => c.competencia?.id)), [comps]);
  const disponiveis = (taxQ.data ?? []).filter((t) => !jaTem.has(t.id));

  const invalidate = () => qc.invalidateQueries({ queryKey: ["passaporte", candidatoId] });

  async function onExtrair() {
    setExtraindo(true);
    try { await extrair({ data: { candidatoId } }); invalidate(); }
    catch (e: any) { alert(e?.message || "Falha ao extrair passaporte."); }
    finally { setExtraindo(false); }
  }
  async function onAdd() {
    if (!novaComp || salvando) return;
    setSalvando(true);
    try { await salvarComp({ data: { candidatoId, competencia_id: novaComp, nivel, origem: "declarada" } }); setNovaComp(""); setNivel(3); invalidate(); }
    catch (e: any) { alert(e?.message || "Falha ao adicionar."); }
    finally { setSalvando(false); }
  }
  async function onRemove(id: string) {
    try { await removerComp({ data: { candidatoId, id } }); invalidate(); }
    catch (e: any) { alert(e?.message); }
  }

  return (
    <div style={{ border: `1px solid ${BORDA}`, borderRadius: 16, padding: 18, marginBottom: 16, background: "#fff" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
        <IdCard size={18} color={ROXO} />
        <span className="h" style={{ fontWeight: 800, fontSize: 15, color: ROXO_DARK, flex: 1 }}>Passaporte de Talentos</span>
        <button onClick={onExtrair} disabled={extraindo} style={{
          display: "flex", alignItems: "center", gap: 6, background: extraindo ? "#D8D2E6" : ROXO, color: "#fff", border: "none",
          padding: "7px 13px", borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: extraindo ? "wait" : "pointer", fontFamily: "inherit",
        }}>
          {extraindo ? <Loader2 size={14} className="spin" /> : <Sparkles size={14} />} Extrair com IA
        </button>
      </div>

      {passQ.isLoading ? (
        <div style={{ fontSize: 13, color: CINZA }}>Carregando…</div>
      ) : (
        <>
          {/* Competências */}
          <div style={{ fontSize: 12, fontWeight: 700, color: ROXO_DARK, marginBottom: 8 }}>Competências</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
            {comps.map((c) => {
              const cor = TIPO_COR[c.competencia?.tipo] ?? ROXO;
              return (
                <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 7, border: `1px solid ${cor}44`, background: cor + "0e", borderRadius: 99, padding: "5px 6px 5px 11px" }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: ROXO_DARK }}>{c.competencia?.nome}</span>
                  <span style={{ display: "flex", gap: 2 }}>
                    {[1, 2, 3, 4, 5].map((n) => <span key={n} style={{ width: 6, height: 6, borderRadius: 99, background: n <= c.nivel ? cor : "#E6E1F0" }} />)}
                  </span>
                  {c.origem === "ia" && <span style={{ fontSize: 9.5, fontWeight: 800, color: LARANJA, textTransform: "uppercase" }}>{ORIGEM_LABEL[c.origem]}</span>}
                  <button onClick={() => onRemove(c.id)} title="Remover" style={{ background: "none", border: "none", cursor: "pointer", color: "#9b93b0", display: "flex", padding: 2 }}><X size={13} /></button>
                </div>
              );
            })}
            {comps.length === 0 && <span style={{ fontSize: 12.5, color: "#9b93b0" }}>Nenhuma competência ainda — use "Extrair com IA" ou adicione abaixo.</span>}
          </div>
          {/* Adicionar competência */}
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginBottom: 16 }}>
            <select value={novaComp} onChange={(e) => setNovaComp(e.target.value)} style={sel}>
              <option value="">Adicionar competência…</option>
              {disponiveis.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
            </select>
            <select value={nivel} onChange={(e) => setNivel(Number(e.target.value))} style={{ ...sel, width: "auto" }}>
              {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>Nível {n}</option>)}
            </select>
            <button onClick={onAdd} disabled={!novaComp || salvando} style={{ display: "flex", alignItems: "center", gap: 5, background: "#fff", color: ROXO, border: `1.5px solid ${BORDA}`, padding: "7px 12px", borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: novaComp ? "pointer" : "not-allowed", opacity: novaComp ? 1 : 0.5, fontFamily: "inherit" }}>
              <Plus size={13} /> Adicionar
            </button>
          </div>

          {/* Experiências */}
          <div style={{ fontSize: 12, fontWeight: 700, color: ROXO_DARK, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}><Briefcase size={13} color={ROXO} /> Experiências</div>
          <div style={{ display: "grid", gap: 7, marginBottom: 16 }}>
            {exps.map((e) => (
              <div key={e.id} style={{ border: `1px solid ${BORDA}`, borderRadius: 10, padding: "9px 12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: ROXO_DARK }}>{e.titulo}</span>
                  {e.organizacao && <span style={{ fontSize: 12, color: CINZA }}>· {e.organizacao}</span>}
                  <span style={{ fontSize: 9.5, fontWeight: 800, color: ROXO, background: ROXO_TINT, padding: "1px 7px", borderRadius: 99, textTransform: "uppercase" }}>{e.tipo}</span>
                </div>
                {e.descricao && <div style={{ fontSize: 12, color: CINZA, marginTop: 3 }}>{e.descricao}</div>}
              </div>
            ))}
            {exps.length === 0 && <span style={{ fontSize: 12.5, color: "#9b93b0" }}>Sem experiências estruturadas ainda.</span>}
          </div>

          {/* Preferências */}
          <div style={{ fontSize: 12, fontWeight: 700, color: ROXO_DARK, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}><Star size={13} color={VERDE} /> Preferências</div>
          {pref ? (
            <div style={{ fontSize: 12.5, color: ROXO_DARK, display: "flex", flexWrap: "wrap", gap: 12 }}>
              {pref.modelo_trabalho && <span>Modelo: <strong>{pref.modelo_trabalho}</strong></span>}
              {pref.disponibilidade && <span>Disponibilidade: <strong>{pref.disponibilidade}</strong></span>}
              {(pref.pretensao_min || pref.pretensao_max) && <span>Pretensão: <strong>{pref.pretensao_min ?? "?"}–{pref.pretensao_max ?? "?"}</strong></span>}
              {Array.isArray(pref.interesses) && pref.interesses.length > 0 && <span>Interesses: {pref.interesses.join(", ")}</span>}
            </div>
          ) : <span style={{ fontSize: 12.5, color: "#9b93b0" }}>Sem preferências registradas.</span>}
        </>
      )}
    </div>
  );
}

const sel: React.CSSProperties = { flex: "1 1 200px", padding: "8px 11px", border: `1.5px solid ${BORDA}`, borderRadius: 9, fontSize: 13, fontFamily: "inherit", color: ROXO_DARK, background: "#fff" };
