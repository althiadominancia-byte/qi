import { ShieldCheck } from "lucide-react";
import { ROXO, ROXO_DARK, LARANJA, LARANJA_TINT, CINZA, BORDA } from "@/lib/recrutamento/data";

export type DivRow = { raca: string | null; genero: string | null; orientacao: string | null; pcd: string | null; politico: string | null };

/**
 * Diversidade AGREGADA e ANÔNIMA. Nunca vinculada a candidato e não influencia a
 * seleção (LGPD / antidiscriminação). Usada no Dashboard da empresa.
 */
export function DiversidadeAgregada({ rows, loading }: { rows: DivRow[]; loading: boolean }) {
  if (loading) return <div style={{ textAlign: "center", padding: 30, color: CINZA }}>Carregando...</div>;
  const N = rows.length;
  const dist = (campo: keyof DivRow) => {
    const m: Record<string, number> = {};
    rows.forEach((c) => { const v = c[campo]; if (v) m[v] = (m[v] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  };
  const grupos: [string, keyof DivRow][] = [["Cor / raça", "raca"], ["Identidade de gênero", "genero"], ["Orientação sexual", "orientacao"], ["Pessoa com deficiência", "pcd"], ["Posicionamento político", "politico"]];
  return (
    <>
      <div style={{ background: LARANJA_TINT, border: `1.5px solid ${LARANJA}33`, borderRadius: 12, padding: 14, display: "flex", gap: 11, marginBottom: 16 }}>
        <ShieldCheck size={20} color={LARANJA} style={{ flexShrink: 0, marginTop: 1 }} />
        <div style={{ fontSize: 12.5, color: ROXO_DARK, lineHeight: 1.55 }}>
          Dados <strong>agregados e anônimos</strong>, com base em {N} inscritos. Não estão vinculados a candidatos e <strong>não influenciam a seleção</strong>, conforme a LGPD.
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14 }}>
        {grupos.map(([titulo, campo]) => (
          <div key={campo} style={{ background: "#fff", border: `1px solid ${BORDA}`, borderRadius: 14, padding: 16 }}>
            <div className="h" style={{ fontWeight: 700, fontSize: 14, marginBottom: 12, color: ROXO_DARK }}>{titulo}</div>
            {N > 0 && dist(campo).map(([k, v]) => (
              <div key={k} style={{ marginBottom: 9 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12.5, marginBottom: 3 }}>
                  <span style={{ color: k === "Prefiro não responder" ? "#9b93b0" : ROXO_DARK }}>{k}</span>
                  <span style={{ fontWeight: 700, color: ROXO }}>{v} · {Math.round((v / N) * 100)}%</span>
                </div>
                <div style={{ height: 8, background: "#F0EDF7", borderRadius: 9 }}>
                  <div style={{ height: 8, width: `${(v / N) * 100}%`, background: k === "Prefiro não responder" ? "#C9C1DC" : ROXO, borderRadius: 9 }} />
                </div>
              </div>
            ))}
            {N === 0 && <div style={{ fontSize: 12, color: CINZA }}>Sem dados ainda.</div>}
          </div>
        ))}
      </div>
    </>
  );
}
