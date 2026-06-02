import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Crown, Building2, Plus, LogOut, Search, ChevronRight, Power,
  ShieldCheck, ArrowRight, Loader2,
} from "lucide-react";
import { MarcaEstrela } from "@/components/MarcaEstrela";
import { supabase } from "@/integrations/supabase/client";
import { getMyScope } from "@/lib/scope.functions";
import { ROXO, ROXO_DARK, ROXO_TINT, LARANJA, CINZA, BORDA, VERDE, VERMELHO } from "@/lib/recrutamento/data";

export const Route = createFileRoute("/_authenticated/super")({
  head: () => ({ meta: [{ title: "Super Admin · Estrela" }] }),
  component: SuperAdminPage,
});

type Empresa = { id: string; nome: string; cnpj: string | null; ativo: boolean; created_at: string };

function SuperAdminPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchScope = useServerFn(getMyScope);
  const scopeQ = useQuery({ queryKey: ["my-scope"], queryFn: () => fetchScope() });
  const scope = scopeQ.data;

  // Guard: somente super_admin
  useEffect(() => {
    if (scopeQ.isSuccess && scope && scope.role !== "super_admin") {
      navigate({ to: "/admin", replace: true });
    }
  }, [scopeQ.isSuccess, scope, navigate]);

  const empresasQ = useQuery({
    queryKey: ["super:empresas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("empresas").select("*").order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Empresa[];
    },
    enabled: !!scope && scope.role === "super_admin",
  });

  const [busca, setBusca] = useState("");
  const empresas = empresasQ.data ?? [];
  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return q ? empresas.filter((e) => e.nome.toLowerCase().includes(q) || (e.cnpj ?? "").toLowerCase().includes(q)) : empresas;
  }, [empresas, busca]);

  const [novoNome, setNovoNome] = useState("");
  const [novoCnpj, setNovoCnpj] = useState("");
  const [criando, setCriando] = useState(false);

  async function criarEmpresa() {
    if (!novoNome.trim()) return;
    setCriando(true);
    const { error } = await supabase.from("empresas").insert({ nome: novoNome.trim(), cnpj: novoCnpj.trim() || null });
    setCriando(false);
    if (error) { alert("Erro ao criar empresa: " + error.message); return; }
    setNovoNome(""); setNovoCnpj("");
    qc.invalidateQueries({ queryKey: ["super:empresas"] });
  }

  async function toggleAtivo(e: Empresa) {
    const { error } = await supabase.from("empresas").update({ ativo: !e.ativo }).eq("id", e.id);
    if (error) { alert(error.message); return; }
    qc.invalidateQueries({ queryKey: ["super:empresas"] });
  }

  function abrirPainel(e: Empresa) {
    try { sessionStorage.setItem("empresa_ativa_id", e.id); } catch {}
    navigate({ to: "/admin", search: { empresa: e.id } });
  }

  async function sair() { await supabase.auth.signOut(); navigate({ to: "/auth", replace: true }); }

  if (scopeQ.isLoading) {
    return <div style={{ padding: 40, textAlign: "center", color: CINZA, fontFamily: "system-ui" }}>Carregando...</div>;
  }
  if (scope && scope.role !== "super_admin") return null;

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", background: "#FBFAFE", minHeight: "100vh", color: ROXO_DARK, paddingBottom: 40 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box} .h{font-family:'Outfit',sans-serif}
        input:focus{outline:none;border-color:${ROXO}!important;box-shadow:0 0 0 3px ${ROXO_TINT}}
        @media(max-width:640px){[data-pad]{padding:0 12px!important}[data-newemp]{flex-direction:column!important}[data-newemp] input,[data-newemp] button{width:100%!important}}
      `}</style>

      <div style={{ background: ROXO_DARK, padding: "13px 18px", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 30 }}>
        <MarcaEstrela size={32} branca />
        <div style={{ lineHeight: 1, minWidth: 0 }}>
          <div className="h" style={{ color: "#fff", fontWeight: 700, letterSpacing: 2, fontSize: 10.5, opacity: 0.85, display: "flex", alignItems: "center", gap: 6 }}>
            <Crown size={12} /> SUPER ADMIN
          </div>
          <div className="h" style={{ color: "#fff", fontWeight: 800, fontSize: 17 }}>Administração da plataforma</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "#fff", opacity: 0.85 }}>{scope?.email}</span>
          <button onClick={sair} style={{ background: "rgba(255,255,255,.15)", color: "#fff", border: "none", padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
            <LogOut size={13} /> Sair
          </button>
        </div>
      </div>

      <div data-pad style={{ maxWidth: 980, margin: "0 auto", padding: "24px 18px" }}>
        <div style={{ background: "#fff", border: `1px solid ${BORDA}`, borderRadius: 14, padding: 18, marginBottom: 16 }}>
          <div className="h" style={{ fontWeight: 800, fontSize: 16, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
            <Building2 size={18} color={ROXO} /> Empresas (tenants)
          </div>
          <div style={{ fontSize: 12.5, color: CINZA, marginBottom: 14 }}>
            Como Super Admin você pode abrir o painel de recrutamento de qualquer empresa e voltar a qualquer momento.
          </div>

          <div data-newemp style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <input value={novoNome} onChange={(e) => setNovoNome(e.target.value)} placeholder="Nome da nova empresa"
              style={{ flex: 1, padding: "10px 12px", border: `1.5px solid ${BORDA}`, borderRadius: 10, fontSize: 13.5 }} />
            <input value={novoCnpj} onChange={(e) => setNovoCnpj(e.target.value)} placeholder="CNPJ (opcional)"
              style={{ width: 180, padding: "10px 12px", border: `1.5px solid ${BORDA}`, borderRadius: 10, fontSize: 13.5 }} />
            <button onClick={criarEmpresa} disabled={criando || !novoNome.trim()}
              style={{ background: LARANJA, color: "#fff", border: "none", padding: "10px 16px", borderRadius: 10, fontSize: 13.5, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, opacity: criando || !novoNome.trim() ? 0.6 : 1 }}>
              {criando ? <Loader2 size={14} className="spin" /> : <Plus size={14} />} Criar empresa
            </button>
          </div>

          <div style={{ position: "relative", marginBottom: 12 }}>
            <Search size={14} color={CINZA} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar empresa..."
              style={{ width: "100%", padding: "10px 12px 10px 34px", border: `1.5px solid ${BORDA}`, borderRadius: 10, fontSize: 13.5 }} />
          </div>

          <div style={{ display: "grid", gap: 8 }}>
            {empresasQ.isLoading && <div style={{ color: CINZA, fontSize: 13, padding: 12 }}>Carregando empresas...</div>}
            {!empresasQ.isLoading && filtradas.length === 0 && (
              <div style={{ color: CINZA, fontSize: 13, padding: 12, textAlign: "center" }}>Nenhuma empresa.</div>
            )}
            {filtradas.map((e) => (
              <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "12px 14px", border: `1px solid ${BORDA}`, borderRadius: 12, background: e.ativo ? "#fff" : "#FAFAFA" }}>
                <div style={{ width: 36, height: 36, borderRadius: 10, background: ROXO_TINT, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Building2 size={18} color={ROXO} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: ROXO_DARK, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    {e.nome}
                    {!e.ativo && <span style={{ fontSize: 10.5, fontWeight: 700, color: VERMELHO, background: "#FEE2E2", padding: "2px 8px", borderRadius: 99 }}>INATIVA</span>}
                  </div>
                  <div style={{ fontSize: 11.5, color: CINZA, marginTop: 2 }}>{e.cnpj || "Sem CNPJ"}</div>
                </div>
                <button onClick={() => toggleAtivo(e)} title={e.ativo ? "Inativar" : "Ativar"}
                  style={{ background: "transparent", border: `1.5px solid ${BORDA}`, color: e.ativo ? VERMELHO : VERDE, padding: "7px 10px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
                  <Power size={12} /> {e.ativo ? "Inativar" : "Ativar"}
                </button>
                <button onClick={() => abrirPainel(e)}
                  style={{ background: ROXO, color: "#fff", border: "none", padding: "8px 14px", borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}>
                  Abrir painel <ArrowRight size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div style={{ background: ROXO_TINT, border: `1px solid ${BORDA}`, borderRadius: 12, padding: 14, fontSize: 12.5, color: ROXO_DARK, display: "flex", gap: 10 }}>
          <ShieldCheck size={18} color={ROXO} style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            Ao abrir o painel de uma empresa você entra no contexto dela como Super Admin. O isolamento entre empresas, o cálculo do match e as regras de LGPD continuam ativos — você pode voltar para esta tela a qualquer momento pelo botão <strong>Administração</strong> ou pela faixa superior do painel.
          </div>
        </div>
      </div>
    </div>
  );
}
