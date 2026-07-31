import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { LayoutDashboard, Briefcase, DoorOpen, UserCheck, Target, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getMyScope } from "@/lib/scope.functions";
import { useFeatures } from "@/lib/recrutamento/use-features";
import { DiversidadeAgregada, type DivRow } from "@/components/DiversidadeAgregada";
import { ROXO, ROXO_DARK, ROXO_TINT, LARANJA, CINZA, BORDA, VERDE } from "@/lib/recrutamento/data";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard" }] }),
  component: DashboardPage,
});

const PERIODOS = [
  { k: "30", label: "30 dias", dias: 30 },
  { k: "90", label: "90 dias", dias: 90 },
  { k: "365", label: "12 meses", dias: 365 },
  { k: "all", label: "Tudo", dias: 0 },
] as const;

function DashboardPage() {
  const fetchScope = useServerFn(getMyScope);
  const scopeQ = useQuery({ queryKey: ["my-scope"], queryFn: () => fetchScope() });
  const scope = scopeQ.data as any;
  const empresaId: string | null = scope?.empresa_id ?? null;
  const { has } = useFeatures();

  const [periodoK, setPeriodoK] = useState<string>("90");
  const periodo = PERIODOS.find((p) => p.k === periodoK) ?? PERIODOS[1];
  const cutoff = periodo.dias > 0 ? new Date(Date.now() - periodo.dias * 86400000).toISOString() : null;

  // Vagas (RLS já escopa por empresa; filtro extra defensivo quando há empresa_id).
  const vagasQ = useQuery({
    queryKey: ["dash:vagas", empresaId],
    queryFn: async () => {
      let q: any = supabase.from("vagas").select("id,status,created_at").limit(5000);
      if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as { id: string; status: string; created_at: string }[];
    },
  });

  // Contratações.
  const contrQ = useQuery({
    queryKey: ["dash:contratacoes", empresaId],
    queryFn: async () => {
      let q: any = supabase.from("contratacoes").select("id,created_at,candidato_id").limit(5000);
      if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as { id: string; created_at: string; candidato_id: string | null }[];
    },
  });

  // Match dos contratados (assertividade).
  const contratados = (contrQ.data ?? []).filter((c) => (cutoff ? c.created_at >= cutoff : true));
  const idsContratados = contratados.map((c) => c.candidato_id).filter(Boolean) as string[];
  const matchQ = useQuery({
    queryKey: ["dash:match-contratados", idsContratados.sort().join(",")],
    enabled: idsContratados.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("candidatos_televendas").select("id,match_final").in("id", idsContratados);
      if (error) throw error;
      return (data ?? []) as { id: string; match_final: number | null }[];
    },
  });

  // Diversidade (gated pela feature).
  const divQ = useQuery({
    queryKey: ["dash:diversidade", empresaId],
    enabled: has("diversidade"),
    queryFn: async () => {
      let q: any = supabase.from("diversidade_candidatos").select("raca,genero,orientacao,pcd,politico").limit(2000);
      if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as DivRow[];
    },
  });

  const m = useMemo(() => {
    const vagas = vagasQ.data ?? [];
    const noPeriodo = (d: string) => (cutoff ? d >= cutoff : true);
    const vagasPeriodo = vagas.filter((v) => noPeriodo(v.created_at));
    const abertas = vagas.filter((v) => v.status === "Aberta").length;
    const contrPeriodo = contratados.length;
    const matches = (matchQ.data ?? []).map((x) => x.match_final).filter((n): n is number => typeof n === "number");
    const assert = matches.length ? Math.round(matches.reduce((a, b) => a + b, 0) / matches.length) : null;
    return { totalVagas: vagas.length, vagasPeriodo: vagasPeriodo.length, abertas, contrPeriodo, assert };
  }, [vagasQ.data, matchQ.data, cutoff, contratados.length]);

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", background: "#FBFAFE", minHeight: "100vh", color: ROXO_DARK, paddingBottom: 40 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box} .h{font-family:'Outfit',sans-serif}`}</style>

      <div style={{ background: ROXO, padding: "14px 18px", display: "flex", alignItems: "center", gap: 10, position: "sticky", top: 0, zIndex: 30 }}>
        <LayoutDashboard size={20} color="#fff" />
        <div className="h" style={{ color: "#fff", fontWeight: 800, fontSize: 17 }}>Dashboard</div>
      </div>

      <div style={{ maxWidth: 1040, margin: "0 auto", padding: 18 }}>
        {/* Filtro de período */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
          {PERIODOS.map((p) => (
            <button key={p.k} onClick={() => setPeriodoK(p.k)} style={{
              padding: "7px 14px", borderRadius: 99, border: `1.5px solid ${periodoK === p.k ? ROXO : BORDA}`,
              background: periodoK === p.k ? ROXO_TINT : "#fff", color: periodoK === p.k ? ROXO_DARK : CINZA,
              fontWeight: periodoK === p.k ? 700 : 500, fontSize: 13, cursor: "pointer", fontFamily: "inherit",
            }}>{p.label}</button>
          ))}
        </div>

        {/* Cards de métricas */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 14, marginBottom: 26 }}>
          <Metrica icon={Briefcase} cor={ROXO} valor={m.vagasPeriodo} label={`Vagas no período`} sub={`${m.totalVagas} no total`} />
          <Metrica icon={DoorOpen} cor={LARANJA} valor={m.abertas} label="Vagas abertas agora" />
          <Metrica icon={UserCheck} cor={VERDE} valor={m.contrPeriodo} label="Contratações no período" />
          <Metrica icon={Target} cor={ROXO} valor={m.assert != null ? `${m.assert}%` : "—"} label="Assertividade (match médio dos contratados)" />
        </div>

        {/* Diversidade */}
        <div className="h" style={{ fontWeight: 800, fontSize: 16, margin: "6px 0 12px", display: "flex", alignItems: "center", gap: 8 }}>
          <Users size={18} color={ROXO} /> Diversidade dos inscritos
        </div>
        {has("diversidade")
          ? <DiversidadeAgregada rows={divQ.data ?? []} loading={divQ.isLoading} />
          : <div style={{ background: "#fff", border: `1px solid ${BORDA}`, borderRadius: 12, padding: 16, fontSize: 13, color: CINZA }}>O relatório de diversidade não está incluído no plano desta empresa.</div>}
      </div>
    </div>
  );
}

function Metrica({ icon: Icon, cor, valor, label, sub }: { icon: any; cor: string; valor: number | string; label: string; sub?: string }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${BORDA}`, borderRadius: 14, padding: 16 }}>
      <div style={{ width: 34, height: 34, borderRadius: 9, background: cor + "18", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 10 }}><Icon size={18} color={cor} /></div>
      <div className="h" style={{ fontSize: 28, fontWeight: 800, color: ROXO_DARK, lineHeight: 1 }}>{valor}</div>
      <div style={{ fontSize: 12, color: CINZA, marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: "#9b93b0", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
