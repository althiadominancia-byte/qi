import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Layers, Plus, Save, Loader2, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getMyScope } from "@/lib/scope.functions";
import { FEATURE_KEYS, FEATURE_LABELS, PLAN_PRESETS, type FeatureKey } from "@/lib/recrutamento/features";
import { ROXO, ROXO_DARK, ROXO_TINT, LARANJA, CINZA, BORDA, VERDE, VERMELHO } from "@/lib/recrutamento/data";

export const Route = createFileRoute("/_authenticated/planos")({
  head: () => ({ meta: [{ title: "Planos · Gestão do SaaS" }] }),
  component: PlanosPage,
});

type Plano = { id: string; nome: string; descricao: string | null; features: Record<string, boolean>; ordem: number; ativo: boolean };

function PlanosPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchScope = useServerFn(getMyScope);
  const scopeQ = useQuery({ queryKey: ["my-scope"], queryFn: () => fetchScope() });
  const scope = scopeQ.data;
  const isSuper = scope?.role === "super_admin";

  useEffect(() => {
    if (scopeQ.isSuccess && scope && !isSuper) navigate({ to: "/admin", replace: true });
  }, [scopeQ.isSuccess, scope, isSuper, navigate]);

  const planosQ = useQuery({
    queryKey: ["planos"],
    enabled: isSuper,
    queryFn: async () => {
      const { data, error } = await supabase.from("planos" as any).select("*").order("ordem");
      if (error) throw error;
      return (data ?? []) as any as Plano[];
    },
  });
  const planos = planosQ.data ?? [];

  if (scopeQ.isLoading) return <div style={{ padding: 40, textAlign: "center", color: CINZA, fontFamily: "system-ui" }}>Carregando...</div>;
  if (scope && !isSuper) return null;

  async function novoPlano() {
    const base = PLAN_PRESETS.basico;
    const { error } = await supabase.from("planos" as any).insert({
      nome: "Novo plano", descricao: "", features: base.features, ordem: planos.length + 1, ativo: true,
    });
    if (error) { alert(error.message); return; }
    qc.invalidateQueries({ queryKey: ["planos"] });
  }

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", background: "#FBFAFE", minHeight: "100vh", color: ROXO_DARK, paddingBottom: 40 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box} .h{font-family:'Outfit',sans-serif}
        input:focus,select:focus,textarea:focus{outline:none;border-color:${ROXO}!important;box-shadow:0 0 0 3px ${ROXO_TINT}}
        @keyframes spin{to{transform:rotate(360deg)}} .spin{animation:spin 1s linear infinite}`}</style>

      <div style={{ background: ROXO, padding: "14px 18px", display: "flex", alignItems: "center", gap: 10, position: "sticky", top: 0, zIndex: 30 }}>
        <Layers size={20} color="#fff" />
        <div className="h" style={{ color: "#fff", fontWeight: 800, fontSize: 17 }}>Configuração de planos</div>
      </div>

      <div style={{ maxWidth: 940, margin: "0 auto", padding: "18px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 8, flexWrap: "wrap" }}>
          <div style={{ fontSize: 13, color: CINZA }}>{planosQ.isLoading ? "Carregando..." : `${planos.length} plano(s)`}</div>
          <button onClick={novoPlano} style={btnLaranja}><Plus size={16} /> Novo plano</button>
        </div>

        <div style={{ display: "grid", gap: 12 }}>
          {planos.map((p) => <PlanoCard key={p.id} plano={p} onSaved={() => qc.invalidateQueries({ queryKey: ["planos"] })} />)}
        </div>

        <div style={{ marginTop: 20, background: ROXO_TINT, border: `1px solid ${BORDA}`, borderRadius: 12, padding: 14, fontSize: 12.5, color: ROXO_DARK, lineHeight: 1.55 }}>
          Aqui você define os <strong>modelos de plano</strong> e quais recursos (entitlements) cada um libera.
          A <strong>atribuição do plano a cada empresa</strong> é feita em <strong>Empresas &amp; Unidades</strong>, no card da empresa.
        </div>
      </div>
    </div>
  );
}

function PlanoCard({ plano, onSaved }: { plano: Plano; onSaved: () => void }) {
  const [nome, setNome] = useState(plano.nome);
  const [descricao, setDescricao] = useState(plano.descricao ?? "");
  const [features, setFeatures] = useState<Record<string, boolean>>(plano.features ?? {});
  const [ativo, setAtivo] = useState(plano.ativo);
  const [saving, setSaving] = useState(false);

  const toggle = (k: FeatureKey) => setFeatures((f) => ({ ...f, [k]: !f[k] }));
  const ligadas = FEATURE_KEYS.filter((k) => features[k]).length;

  async function salvar() {
    setSaving(true);
    const { error } = await supabase.from("planos" as any).update({
      nome: nome.trim(), descricao: descricao.trim() || null, features, ativo, updated_at: new Date().toISOString(),
    }).eq("id", plano.id);
    setSaving(false);
    if (error) { alert(error.message); return; }
    onSaved();
  }

  return (
    <div style={{ background: "#fff", border: `1px solid ${BORDA}`, borderRadius: 14, padding: 16 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <input value={nome} onChange={(e) => setNome(e.target.value)} style={{ ...inp, flex: "1 1 200px", fontWeight: 700 }} />
        <span style={{ fontSize: 12, color: CINZA }}>{ligadas}/{FEATURE_KEYS.length} recursos</span>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: ROXO_DARK, cursor: "pointer" }}>
          <input type="checkbox" checked={ativo} onChange={(e) => setAtivo(e.target.checked)} /> ativo
        </label>
      </div>
      <input value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="Descrição do plano" style={{ ...inp, marginBottom: 12 }} />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 8 }}>
        {FEATURE_KEYS.map((k) => {
          const on = !!features[k];
          return (
            <button key={k} onClick={() => toggle(k)} style={{
              display: "flex", alignItems: "flex-start", gap: 9, textAlign: "left", padding: "9px 11px", borderRadius: 10, cursor: "pointer", fontFamily: "inherit",
              border: `1.5px solid ${on ? VERDE : BORDA}`, background: on ? VERDE + "10" : "#fff",
            }}>
              <span style={{ width: 18, height: 18, borderRadius: 5, flexShrink: 0, marginTop: 1, display: "flex", alignItems: "center", justifyContent: "center", background: on ? VERDE : "#fff", border: `1.5px solid ${on ? VERDE : BORDA}`, color: "#fff" }}>
                {on ? <Check size={13} /> : <X size={12} color={BORDA} />}
              </span>
              <span>
                <span style={{ fontSize: 12.8, fontWeight: 700, color: ROXO_DARK, display: "block" }}>{FEATURE_LABELS[k].nome}</span>
                <span style={{ fontSize: 11, color: CINZA }}>{FEATURE_LABELS[k].desc}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 12 }}>
        <button onClick={salvar} disabled={saving} style={{ ...btnLaranja, opacity: saving ? 0.6 : 1 }}>
          {saving ? <Loader2 size={15} className="spin" /> : <Save size={15} />} Salvar plano
        </button>
      </div>
    </div>
  );
}

const inp: React.CSSProperties = { width: "100%", padding: "10px 12px", border: `1.5px solid ${BORDA}`, borderRadius: 10, fontSize: 13.5, fontFamily: "inherit", color: ROXO_DARK, background: "#fff", boxSizing: "border-box" };
const btnLaranja: React.CSSProperties = { background: LARANJA, color: "#fff", border: "none", padding: "10px 16px", borderRadius: 11, fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 7, fontFamily: "inherit" };
