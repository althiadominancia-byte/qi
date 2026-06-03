import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search, Users, TrendingUp, Award, ChevronRight, ChevronLeft, X, Phone, Mail,
  Briefcase, Star, AlertCircle, Lightbulb, BarChart3, ShieldCheck, Calendar, Headphones,
  Filter, FileText, LogOut, Plus, Save, Pencil, Ban, CalendarClock, Wand2, Loader2,
  Circle, Info, Link2, Copy, Check, Target, Layers, GraduationCap, Settings2, Calculator,
  Crown, Building2, ChevronDown, RefreshCw, UserCog,
} from "lucide-react";
import { MarcaEstrela } from "@/components/MarcaEstrela";
import { supabase } from "@/integrations/supabase/client";
import { gerarPerfilVaga, excluirVaga } from "@/lib/recrutamento.functions";
import { getMyScope } from "@/lib/scope.functions";
import { useServerFn } from "@tanstack/react-start";
import {
  ROXO, ROXO_DARK, ROXO_TINT, LARANJA, LARANJA_TINT, CINZA, BORDA, VERDE, VERMELHO, AMARELO,
  PERFIS, DIM_INFO, ORDEM_PERFIS, labelMatch, corMatch, corNivel, txtNivel,
  matchDe, statusVaga, efetivamenteEncerrada, fmtData, rotuloPeso, novaVagaVazia,
  type Vaga, type PerfilKey, type NivelHab,
} from "@/lib/recrutamento/data";

type AdminSearch = { empresa?: string };

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Painel do Recrutador · Estrela" }] }),
  validateSearch: (s: Record<string, unknown>): AdminSearch => ({
    empresa: typeof s.empresa === "string" ? s.empresa : undefined,
  }),
  component: AdminPage,
});

type Candidato = {
  id: string; created_at: string; vaga_id: string | null;
  nome: string; email: string; celular: string; setor_atual: string | null;
  perfil_key: string | null; perfil_nome: string | null;
  match_final: number | null; match_label: string | null; postura_score: number | null;
  disc_pontuacao: any; cv_analise: any; cv_storage_path: string | null; cv_nome_arquivo: string | null;
  experiencia_texto: string | null;
};
type DivRow = { raca: string | null; genero: string | null; orientacao: string | null; pcd: string | null; politico: string | null };

const inp: React.CSSProperties = { width: "100%", padding: "10px 12px", border: `1.5px solid ${BORDA}`, borderRadius: 10, fontSize: 13.5, outline: "none", background: "#fff", color: ROXO_DARK, fontFamily: "inherit" };

function AdminPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [aba, setAba] = useState<"vagas" | "candidatos" | "diversidade">("vagas");
  const [editando, setEditando] = useState<Vaga | null>(null);
  const [vagaSel, setVagaSel] = useState<string | null>(null);
  const [sel, setSel] = useState<Candidato | null>(null);
  const qc = useQueryClient();

  const fetchScope = useServerFn(getMyScope);
  const excluirVagaFn = useServerFn(excluirVaga);
  const scopeQ = useQuery({ queryKey: ["my-scope"], queryFn: () => fetchScope() });
  const scope = scopeQ.data;
  const isSuper = scope?.role === "super_admin";

  // Empresa ativa: super_admin escolhe via ?empresa=; outros são fixados pela própria empresa.
  const empresaAtivaId = isSuper ? (search.empresa ?? null) : (scope?.empresa_id ?? null);

  // super_admin sem empresa selecionada → volta para Administração
  useEffect(() => {
    if (scopeQ.isSuccess && isSuper && !search.empresa) {
      // Tenta recuperar última empresa visitada
      let last: string | null = null;
      try { last = sessionStorage.getItem("empresa_ativa_id"); } catch {}
      if (last) {
        navigate({ to: "/admin", search: { empresa: last }, replace: true });
      } else {
        navigate({ to: "/super", replace: true });
      }
    }
  }, [scopeQ.isSuccess, isSuper, search.empresa, navigate]);

  // Persistir empresa ativa
  useEffect(() => {
    if (isSuper && search.empresa) {
      try { sessionStorage.setItem("empresa_ativa_id", search.empresa); } catch {}
    }
  }, [isSuper, search.empresa]);

  // Lista de empresas (apenas super_admin precisa do seletor)
  const empresasQ = useQuery({
    queryKey: ["empresas:list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("empresas").select("id, nome, ativo").order("nome");
      if (error) throw error;
      return data ?? [];
    },
    enabled: isSuper,
  });
  const empresaAtiva = (empresasQ.data ?? []).find((e: any) => e.id === empresaAtivaId) ?? null;

  const unidadesQ = useQuery({
    queryKey: ["unidades", empresaAtivaId ?? "none"],
    queryFn: async () => {
      if (!empresaAtivaId) return [];
      const { data, error } = await supabase
        .from("unidades")
        .select("id, nome, cidade, tipo")
        .eq("empresa_id", empresaAtivaId)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !isSuper || !!empresaAtivaId,
  });
  const unidadePadraoId = (unidadesQ.data ?? [])[0]?.id ?? null;

  const vagasQ = useQuery({
    queryKey: ["vagas", empresaAtivaId ?? "all"],
    queryFn: async () => {
      let q = supabase.from("vagas").select("*").order("created_at", { ascending: false });
      if (empresaAtivaId) q = q.eq("empresa_id", empresaAtivaId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Vaga[];
    },
    enabled: !isSuper || !!empresaAtivaId,
  });

  const candidatosQ = useQuery({
    queryKey: ["candidatos", empresaAtivaId ?? "all"],
    queryFn: async () => {
      let q = supabase.from("candidatos_televendas").select("*").order("created_at", { ascending: false }).limit(1000);
      if (empresaAtivaId) q = q.eq("empresa_id", empresaAtivaId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Candidato[];
    },
    enabled: !isSuper || !!empresaAtivaId,
  });

  const diversidadeQ = useQuery({
    queryKey: ["diversidade", empresaAtivaId ?? "all"],
    queryFn: async () => {
      let q: any = supabase.from("diversidade_candidatos").select("raca,genero,orientacao,pcd,politico").limit(2000);
      if (empresaAtivaId) q = q.eq("empresa_id", empresaAtivaId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as DivRow[];
    },
    enabled: aba === "diversidade" && (!isSuper || !!empresaAtivaId),
  });

  const vagas = vagasQ.data ?? [];
  const vagaAtual = vagas.find((v) => v.id === vagaSel) || vagas[0] || null;

  useEffect(() => {
    if (!vagaSel && vagas[0]) setVagaSel(vagas[0].id);
  }, [vagas, vagaSel]);


  async function salvarVaga(v: Vaga | (Omit<Vaga, "id" | "link_token"> & { id?: string; link_token?: string })) {
    if (!(v as any).departamento_id || !(v as any).setor_id) {
      alert("Selecione Departamento e Setor.");
      return;
    }
    const payload: any = {
      titulo: v.titulo, modelo: v.modelo, tipo: v.tipo, vagas: v.vagas,
      status: v.status, descricao: v.descricao, data_limite: v.data_limite || null,
      pesos: v.pesos, habilidades: v.habilidades, competencias: v.competencias,
      experiencia: v.experiencia, escolaridade: v.escolaridade, requisitos: v.requisitos,
      usar_situacional: v.usar_situacional,
      interna: v.interna ?? true,
      motivo: (v as any).motivo ?? "",
      departamento_id: (v as any).departamento_id,
      setor_id: (v as any).setor_id,
    };
    if ((v as any).unidade_id) payload.unidade_id = (v as any).unidade_id;
    if ((v as any).id) {
      const { error } = await supabase.from("vagas").update(payload).eq("id", (v as any).id);
      if (error) { alert("Erro ao salvar: " + error.message); return; }
    } else {
      if (!empresaAtivaId) { alert("Selecione uma empresa antes de criar a vaga."); return; }
      const unidadeId = (v as any).unidade_id || unidadePadraoId;
      if (!unidadeId) { alert("Cadastre ou selecione uma unidade antes de criar a vaga."); return; }
      const { error } = await supabase.from("vagas").insert({ ...payload, empresa_id: empresaAtivaId, unidade_id: unidadeId });
      if (error) { alert("Erro ao criar: " + error.message); return; }
    }
    setEditando(null);
    qc.invalidateQueries({ queryKey: ["vagas"] });
  }

  async function encerrarVaga(id: string) {
    if (!confirm("Encerrar esta vaga? O link público fica inativo.")) return;
    const { error } = await supabase.from("vagas").update({ status: "Fechada" }).eq("id", id);
    if (error) { alert(error.message); return; }
    qc.invalidateQueries({ queryKey: ["vagas"] });
  }
  async function sair() { await supabase.auth.signOut(); navigate({ to: "/auth", replace: true }); }

  const contagem = (vid: string) => (candidatosQ.data ?? []).filter((c) => c.vaga_id === vid).length;

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", background: "#FBFAFE", minHeight: "100vh", color: ROXO_DARK, paddingBottom: 40 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box} html,body{overflow-x:hidden;max-width:100vw} .h{font-family:'Outfit',sans-serif}
        input:focus,select:focus,textarea:focus{outline:none;border-color:${ROXO}!important;box-shadow:0 0 0 3px ${ROXO_TINT}}
        input[type=range]{accent-color:${ROXO};min-height:36px}
        @keyframes spin{to{transform:rotate(360deg)}} .spin{animation:spin 1s linear infinite}
        @media (max-width:640px){
          input,select,textarea{font-size:16px !important}
          [data-pad]{padding:0 12px !important}
          [data-grid]{grid-template-columns:1fr !important}
          [data-tabs]{flex-wrap:nowrap !important;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none}
          [data-tabs]::-webkit-scrollbar{display:none}
          [data-tabs] button{flex-shrink:0;min-height:44px}
          [data-header-sub]{display:none !important}
          [data-link-row]{flex-wrap:wrap !important;gap:8px !important}
          [data-link-row] > code{flex:1 1 100% !important;white-space:normal !important;word-break:break-all;overflow:visible !important;text-overflow:clip !important}
          [data-link-row] > button,[data-link-row] > span{width:100% !important;justify-content:center !important;min-height:44px;text-align:center}
          [data-vaga-actions]{flex-direction:column !important}
          [data-vaga-actions] button{width:100% !important;justify-content:center !important;min-height:44px}
          [data-slider-row]{flex-wrap:wrap !important;gap:8px !important;padding:14px 0 !important}
          [data-slider-row] > [data-slider-label]{flex:1 1 100% !important;width:auto !important}
          [data-slider-row] > input[type=range]{flex:1 1 100% !important;width:100% !important}
          [data-slider-row] > [data-slider-val]{width:auto !important;text-align:left !important;flex:0 0 auto}
          [data-drawer]{width:100% !important;max-width:100% !important}
          [data-drawer-close]{min-width:44px;min-height:44px}
          [data-mini-row]{flex-direction:column !important}
          [data-mini-row] > div{flex:1 1 auto !important;width:100%}
          [data-cand-row]{flex-wrap:wrap !important;gap:10px !important}
          [data-cand-row] > [data-cand-main]{flex:1 1 calc(100% - 56px) !important;min-width:0}
          [data-cand-row] > [data-cand-perfil]{order:5}
          [data-cand-row] > [data-cand-match]{order:6;margin-left:auto}
          [data-cand-row] > [data-cand-arrow]{order:7}
          [data-ai-card]{flex-direction:column !important;align-items:stretch !important}
          [data-ai-card] > button{width:100% !important;justify-content:center !important;min-height:44px}
          [data-vaga-meta]{font-size:11.5px !important;gap:8px !important}
          [data-filtros]{flex-direction:column !important;align-items:stretch !important}
          [data-filtros] > *{width:100% !important;flex:1 1 100% !important}
          [data-vaga-sel] select{width:100% !important;min-width:0 !important}
          [data-save-row]{flex-direction:column !important}
          [data-save-row] button{width:100% !important;justify-content:center !important;min-height:48px}
          [data-hab-add]{flex-wrap:wrap !important}
          [data-hab-add] > input{flex:1 1 100% !important}
        }
      `}</style>

      <div style={{ background: ROXO, padding: "13px 18px", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 30, flexWrap: "wrap" }}>
        <MarcaEstrela size={32} branca />
        <div style={{ lineHeight: 1, minWidth: 0 }}>
          <div data-header-sub className="h" style={{ color: "#fff", fontWeight: 700, letterSpacing: 2, fontSize: 10.5, opacity: 0.85 }}>
            {empresaAtiva?.nome?.toUpperCase() || "DISTRIBUIDORA ESTRELA"}
          </div>
          <div className="h" style={{ color: "#fff", fontWeight: 800, fontSize: 17 }}>Painel do Recrutador</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center", color: "#fff", flexWrap: "wrap" }}>
          {isSuper && (
            <>
              <select
                value={empresaAtivaId ?? ""}
                onChange={(e) => {
                  const id = e.target.value;
                  if (!id) return;
                  try { sessionStorage.setItem("empresa_ativa_id", id); } catch {}
                  navigate({ to: "/admin", search: { empresa: id } });
                }}
                style={{ background: "rgba(255,255,255,.15)", color: "#fff", border: "1px solid rgba(255,255,255,.3)", padding: "7px 10px", borderRadius: 8, fontSize: 12.5, fontWeight: 600, fontFamily: "inherit", cursor: "pointer", maxWidth: 220 }}
              >
                {(empresasQ.data ?? []).map((e: any) => (
                  <option key={e.id} value={e.id} style={{ color: ROXO_DARK }}>
                    {e.nome}{!e.ativo ? " (inativa)" : ""}
                  </option>
                ))}
              </select>
              <button onClick={() => { try { sessionStorage.removeItem("empresa_ativa_id"); } catch {}; navigate({ to: "/super" }); }}
                title="Voltar à Administração"
                style={{ background: LARANJA, color: "#fff", border: "none", padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5, minHeight: 36 }}>
                <Crown size={13} /> Administração
              </button>
            </>
          )}
          {!isSuper && !!scope?.perms?.gerenciar_usuarios && (
            <button onClick={() => navigate({ to: "/super" })}
              title="Gerenciar equipe"
              style={{ background: LARANJA, color: "#fff", border: "none", padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5, minHeight: 36 }}>
              <UserCog size={13} /> Equipe
            </button>
          )}
          {(isSuper || !!scope?.perms?.gerenciar_usuarios) && (
            <button onClick={() => navigate({ to: "/permissoes" })}
              title="Permissões"
              style={{ background: "#fff", color: ROXO, border: `1px solid ${BORDA}`, padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5, minHeight: 36 }}>
              <ShieldCheck size={13} /> Permissões
            </button>
          )}
          {(isSuper || !!scope?.perms?.gerenciar_catalogo) && empresaAtivaId && (
            <button onClick={() => navigate({ to: "/catalogo", search: { empresa: empresaAtivaId } })}
              title="Departamentos e Setores"
              style={{ background: "#fff", color: ROXO, border: `1px solid ${BORDA}`, padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5, minHeight: 36 }}>
              <Layers size={13} /> Catálogo
            </button>
          )}

          <span data-header-sub style={{ fontSize: 12, opacity: 0.8, display: "flex", alignItems: "center", gap: 6 }}><Headphones size={15} /> Recrutamento interno</span>

          <button onClick={sair} style={{ background: "rgba(255,255,255,.15)", color: "#fff", border: "none", padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit", display: "flex", alignItems: "center", gap: 5, minHeight: 36 }}><LogOut size={13} /> Sair</button>
        </div>
      </div>

      {isSuper && empresaAtiva && (
        <div style={{ background: ROXO_TINT, borderBottom: `1px solid ${BORDA}`, padding: "10px 18px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", fontSize: 12.5, color: ROXO_DARK }}>
          <Crown size={14} color={ROXO} />
          <div style={{ flex: 1, minWidth: 0 }}>
            Você está como <strong>Super Admin</strong> visualizando <strong>{empresaAtiva.nome}</strong>
            {!empresaAtiva.ativo && <span style={{ marginLeft: 8, color: VERMELHO, fontWeight: 700 }}>· EMPRESA INATIVA</span>}
          </div>
          <button onClick={() => { try { sessionStorage.removeItem("empresa_ativa_id"); } catch {}; navigate({ to: "/super" }); }}
            style={{ background: "#fff", color: ROXO, border: `1px solid ${BORDA}`, padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
            <Building2 size={12} /> Trocar empresa
          </button>
          <button onClick={() => { try { sessionStorage.removeItem("empresa_ativa_id"); } catch {}; navigate({ to: "/super" }); }}
            style={{ background: ROXO, color: "#fff", border: "none", padding: "6px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
            Sair do contexto
          </button>
        </div>
      )}



      <div data-pad style={{ maxWidth: 980, margin: "0 auto", padding: "0 18px" }}>
        <div data-tabs style={{ display: "flex", gap: 6, margin: "18px 0", flexWrap: "wrap" }}>
          {([["vagas", "Vagas", Briefcase], ["candidatos", "Candidatos", Users], ["diversidade", "Diversidade (agregado)", BarChart3]] as const).map(([k, t, Ic]) => (
            <button key={k} onClick={() => { setAba(k as any); setEditando(null); }} style={{
              display: "flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 11, cursor: "pointer", fontFamily: "inherit",
              fontSize: 13.5, fontWeight: 700, border: `1.5px solid ${aba === k ? ROXO : BORDA}`,
              background: aba === k ? ROXO : "#fff", color: aba === k ? "#fff" : CINZA,
            }}><Ic size={15} /> {t}</button>
          ))}
        </div>

        {(vagasQ.isError || candidatosQ.isError) && (
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: 14, marginBottom: 14, color: "#B91C1C", fontSize: 13 }}>
            Erro ao carregar dados. Verifique se você tem o papel de recrutador.
          </div>
        )}

        {aba === "vagas" && (editando
          ? <ConstrutorVaga vaga={editando} empresaId={empresaAtivaId} unidades={unidadesQ.data ?? []} onSave={salvarVaga} onCancel={() => setEditando(null)} />

          : <VagasLista vagas={vagas} loading={vagasQ.isLoading} contagem={contagem}
              onPrevia={(v: Vaga) => navigate({ to: "/previa/$id", params: { id: v.id } })}
              onNova={() => setEditando({ ...(novaVagaVazia() as any), id: undefined, unidade_id: unidadePadraoId ?? undefined } as any)}
              onEditar={(v: Vaga) => setEditando(v)}
              onVerCand={(v: Vaga) => { setVagaSel(v.id); setAba("candidatos"); }}
              onEncerrar={encerrarVaga} />
        )}

        {aba === "candidatos" && (
          <CandidatosLista vagas={vagas} vagaSel={vagaSel} setVagaSel={setVagaSel} vagaAtual={vagaAtual}
            candidatos={candidatosQ.data ?? []} loading={candidatosQ.isLoading} onAbrir={setSel} />
        )}

        {aba === "diversidade" && <Diversidade rows={diversidadeQ.data ?? []} loading={diversidadeQ.isLoading} />}
      </div>

      {sel && <Detalhe c={sel} vaga={vagas.find((v) => v.id === sel.vaga_id) || null} onClose={() => setSel(null)} />}
    </div>
  );
}

/* ========== Aba Vagas — Lista ========== */
function VagasLista({ vagas, loading, contagem, onNova, onEditar, onVerCand, onEncerrar, onPrevia }: any) {
  if (loading) return <div style={{ textAlign: "center", padding: 30, color: CINZA }}>Carregando...</div>;
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: CINZA }}>{vagas.length} vaga(s) cadastrada(s)</div>
        <button onClick={onNova} style={{ background: LARANJA, color: "#fff", border: "none", padding: "10px 16px", borderRadius: 11, fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 7, fontFamily: "inherit" }}>
          <Plus size={16} /> Nova vaga
        </button>
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {vagas.map((v: Vaga) => {
          const topo = [...ORDEM_PERFIS].sort((a, b) => (v.pesos as any)[b] - (v.pesos as any)[a]).slice(0, 2);
          const st = statusVaga(v);
          return (
            <div key={v.id} style={{ background: "#fff", border: `1px solid ${BORDA}`, borderRadius: 14, padding: "16px 18px" }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9, flexWrap: "wrap" }}>
                    <span className="h" style={{ fontWeight: 800, fontSize: 17, color: ROXO_DARK }}>{v.titulo || "(sem título)"}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, color: st.cor, background: st.cor + "18", padding: "3px 10px", borderRadius: 99 }}>
                      <Circle size={7} fill={st.cor} color={st.cor} /> {st.label}
                    </span>
                    {v.interna === false && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: "#2563EB", background: "#EFF6FF", padding: "3px 9px", borderRadius: 99 }}>
                        Externa
                      </span>
                    )}
                    {!(v as any).formulario_aprovado && (
                      <span title="Formulário ainda não aprovado" style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: "#9a6b00", background: "#FEF3C7", padding: "3px 9px", borderRadius: 99 }}>
                        <AlertCircle size={11} /> Formulário não aprovado
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 12.5, color: "#9b93b0", marginTop: 3, display: "flex", gap: 12, flexWrap: "wrap" }}>
                    <span>{v.setor}</span><span>{v.modelo} · {v.tipo}</span><span>{v.vagas} posição(ões)</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Users size={12} /> {contagem(v.id)} candidato(s)</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}><CalendarClock size={12} /> {v.data_limite ? `até ${fmtData(v.data_limite)}` : "sem prazo"}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: CINZA, marginTop: 8 }}>
                    Perfil-alvo: {topo.map((k, i) => <span key={k} style={{ fontWeight: 700, color: PERFIS[k].cor }}>{PERFIS[k].nome}{i === 0 ? " · " : ""}</span>)}
                  </div>
                </div>
              </div>
              <LinkPublico vaga={v} />
              <div data-vaga-actions style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                <button onClick={() => onEditar(v)} style={btnSec}><Pencil size={14} /> Editar perfil</button>
                <button onClick={() => onPrevia(v)} style={btnSec}><FileText size={14} /> Prévia do formulário</button>
                <button onClick={() => onVerCand(v)} style={btnPri}><Users size={14} /> Ver candidatos <ChevronRight size={15} /></button>
                {!efetivamenteEncerrada(v) && <button onClick={() => onEncerrar(v.id)} style={btnEnc}><Ban size={14} /> Encerrar vaga</button>}
              </div>
            </div>
          );
        })}
        {vagas.length === 0 && <div style={{ textAlign: "center", padding: 40, color: CINZA, background: "#fff", border: `1px solid ${BORDA}`, borderRadius: 14 }}>Nenhuma vaga ainda. Crie a primeira!</div>}
      </div>
    </>
  );
}

const DOMINIO_PUBLICO = "https://recrutamento.distribuidoraestrela.com";
const SHORT_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";
function genShortCode(len = 6) {
  let s = "";
  const buf = new Uint32Array(len);
  crypto.getRandomValues(buf);
  for (let i = 0; i < len; i++) s += SHORT_ALPHABET[buf[i] % SHORT_ALPHABET.length];
  return s;
}
function genLinkToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function LinkPublico({ vaga }: { vaga: Vaga }) {
  const qc = useQueryClient();
  const [copiado, setCopiado] = useState(false);
  const [regenerando, setRegenerando] = useState(false);
  const [erro, setErro] = useState("");
  const ativa = !efetivamenteEncerrada(vaga) && vaga.status === "Aberta";
  const sc = (vaga as any).short_code;
  const url = sc ? `${DOMINIO_PUBLICO}/s/${sc}` : `${DOMINIO_PUBLICO}/c/${vaga.link_token}`;

  async function regenerar() {
    if (regenerando) return;
    const ok = window.confirm(
      "Gerar um link novo? O link atual deixará de funcionar imediatamente e quem já recebeu o link antigo não conseguirá mais se inscrever."
    );
    if (!ok) return;
    setRegenerando(true); setErro("");
    try {
      // Tenta gerar short_code único (retry curto em caso raro de colisão)
      let novoShort = "";
      for (let i = 0; i < 5; i++) {
        const cand = genShortCode();
        const { data: exists } = await supabase.from("vagas").select("id").eq("short_code", cand).maybeSingle();
        if (!exists) { novoShort = cand; break; }
      }
      if (!novoShort) throw new Error("Não foi possível gerar um código curto único.");
      const novoToken = genLinkToken();
      const { error } = await supabase.from("vagas")
        .update({ short_code: novoShort, link_token: novoToken })
        .eq("id", vaga.id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["vagas"] });
    } catch (e: any) {
      setErro(e.message || "Falha ao regenerar.");
    } finally {
      setRegenerando(false);
    }
  }

  return (
    <div style={{ marginTop: 12 }}>
      <div data-link-row style={{ background: ativa ? ROXO_TINT : "#F4F1FB55", border: `1px solid ${BORDA}`, borderRadius: 10, padding: "10px 12px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <Link2 size={14} color={ativa ? ROXO : "#9b93b0"} />
        <code style={{ flex: 1, fontSize: 11.5, color: ativa ? ROXO_DARK : "#9b93b0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{url}</code>
        {ativa ? (
          <>
            <button
              onClick={async () => { await navigator.clipboard.writeText(url); setCopiado(true); setTimeout(() => setCopiado(false), 1500); }}
              style={{ background: copiado ? VERDE : ROXO, color: "#fff", border: "none", padding: "7px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, fontFamily: "inherit", minHeight: 36 }}
            >
              {copiado ? <><Check size={12} /> Copiado</> : <><Copy size={12} /> Copiar</>}
            </button>
            <button
              onClick={regenerar}
              disabled={regenerando}
              title="Gerar um novo link (o atual deixa de funcionar)"
              style={{ background: "#fff", color: ROXO, border: `1.5px solid ${ROXO}55`, padding: "7px 10px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: regenerando ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, fontFamily: "inherit", minHeight: 36 }}
            >
              {regenerando ? <Loader2 size={12} className="spin" /> : <RefreshCw size={12} />} Regenerar
            </button>
          </>
        ) : (
          <span style={{ fontSize: 10.5, color: "#9b93b0", fontWeight: 700 }}>INATIVO</span>
        )}
      </div>
      {erro && <div style={{ marginTop: 6, fontSize: 11.5, color: "#B91C1C" }}>{erro}</div>}
    </div>
  );
}

/* ========== Aba Vagas — Construtor ========== */
function ConstrutorVaga({ vaga, empresaId, unidades, onSave, onCancel }: { vaga: any; empresaId: string | null; unidades: any[]; onSave: (v: any) => void; onCancel: () => void }) {
  const [v, setV] = useState<any>(vaga);
  const set = (k: string, val: any) => setV((p: any) => ({ ...p, [k]: val }));
  const [novaHab, setNovaHab] = useState("");
  const [nivelNovaHab, setNivelNovaHab] = useState<NivelHab>("importante");
  const [novaComp, setNovaComp] = useState("");
  const [simPerfil, setSimPerfil] = useState<PerfilKey>("comunicador");
  const [simPostura, setSimPostura] = useState(85);
  const [gerando, setGerando] = useState(false);
  const [erroIA, setErroIA] = useState("");

  const depsQ = useQuery({
    queryKey: ["catalogo:deps", empresaId],
    queryFn: async () => {
      let q = supabase.from("departamentos").select("id,nome,ativo,ordem").order("ordem").order("nome");
      if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!empresaId,
  });
  const setoresQ = useQuery({
    queryKey: ["catalogo:setores", empresaId, v.departamento_id],
    queryFn: async () => {
      const { data, error } = await supabase.from("setores")
        .select("id,nome,ativo,ordem,departamento_id")
        .eq("departamento_id", v.departamento_id)
        .order("ordem").order("nome");
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!v.departamento_id,
  });

  useEffect(() => {
    if (!v.unidade_id && unidades[0]?.id) set("unidade_id", unidades[0].id);
  }, [unidades, v.unidade_id]);

  const base = v.pesos[simPerfil];
  const matchSim = Math.round(base * 0.6 + simPostura * 0.4);
  const corSim = corMatch(matchSim);

  const setPeso = (k: PerfilKey, val: number) => setV((p: any) => ({ ...p, pesos: { ...p.pesos, [k]: val } }));
  const setNivelHabValor = (i: number, nivel: NivelHab) => setV((p: any) => { const h = [...p.habilidades]; h[i] = { ...h[i], nivel }; return { ...p, habilidades: h }; });

  const addHab = () => { if (novaHab.trim()) { setV((p: any) => ({ ...p, habilidades: [...p.habilidades, { nome: novaHab.trim(), nivel: nivelNovaHab }] })); setNovaHab(""); } };
  const rmHab = (i: number) => setV((p: any) => ({ ...p, habilidades: p.habilidades.filter((_: any, j: number) => j !== i) }));
  const addComp = () => { if (novaComp.trim()) { setV((p: any) => ({ ...p, competencias: [...p.competencias, novaComp.trim()] })); setNovaComp(""); } };
  const rmComp = (i: number) => setV((p: any) => ({ ...p, competencias: p.competencias.filter((_: any, j: number) => j !== i) }));

  async function gerarIA() {
    if (!v.titulo.trim()) { setErroIA("Preencha ao menos o título da vaga antes de gerar."); return; }
    setGerando(true); setErroIA("");
    try {
      const g: any = await gerarPerfilVaga({ data: { titulo: v.titulo, setor: v.setor, modelo: v.modelo, tipo: v.tipo, descricao: v.descricao } });
      const pesosNum = Object.fromEntries(Object.entries(g.pesos || {}).map(([k, val]) => [k, Math.max(0, Math.min(100, Number(val) || 0))]));
      setV((p: any) => ({
        ...p, pesos: { ...p.pesos, ...pesosNum },
        descricao: (typeof g.descricao === "string" && g.descricao.trim()) ? g.descricao.trim() : p.descricao,
        habilidades: Array.isArray(g.habilidades) && g.habilidades.length ? g.habilidades : p.habilidades,
        competencias: Array.isArray(g.competencias) && g.competencias.length ? g.competencias : p.competencias,
        experiencia: g.experiencia || p.experiencia, escolaridade: g.escolaridade || p.escolaridade, requisitos: g.requisitos || p.requisitos,
      }));

    } catch (e: any) { setErroIA(e.message || "Falha ao gerar."); }
    finally { setGerando(false); }
  }

  return (
    <div style={{ display: "grid", gap: 14 }}>
      <button onClick={onCancel} style={{ background: "none", border: "none", color: CINZA, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontFamily: "inherit", fontSize: 13.5, justifySelf: "start" }}><ChevronLeft size={16} /> Voltar para vagas</button>

      <CardBox><Cab icon={Briefcase} t="Dados da vaga" />
        <CampoLabel label="Título da vaga"><input style={inp} value={v.titulo} onChange={(e) => set("titulo", e.target.value)} placeholder="Ex.: Televendas (Interna)" /></CampoLabel>
        <div data-grid style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <CampoLabel label="Departamento">
            <select style={inp} value={v.departamento_id || ""} onChange={(e) => setV((p: any) => ({ ...p, departamento_id: e.target.value || null, setor_id: null, setor: "" }))}>
              <option value="">Selecione…</option>
              {(depsQ.data ?? []).filter((d: any) => d.ativo || d.id === v.departamento_id).map((d: any) => (
                <option key={d.id} value={d.id}>{d.nome}{!d.ativo ? " (inativo)" : ""}</option>
              ))}
            </select>
          </CampoLabel>
          <CampoLabel label="Setor">
            <select style={inp} value={v.setor_id || ""} disabled={!v.departamento_id} onChange={(e) => {
              const id = e.target.value || null;
              const found = (setoresQ.data ?? []).find((s: any) => s.id === id);
              setV((p: any) => ({ ...p, setor_id: id, setor: found?.nome ?? "" }));
            }}>
              <option value="">{v.departamento_id ? "Selecione…" : "Escolha o departamento"}</option>
              {(setoresQ.data ?? []).filter((s: any) => s.ativo || s.id === v.setor_id).map((s: any) => (
                <option key={s.id} value={s.id}>{s.nome}{!s.ativo ? " (inativo)" : ""}</option>
              ))}
            </select>
          </CampoLabel>
        </div>
        <div data-grid style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <CampoLabel label="Modelo"><select style={inp} value={v.modelo} onChange={(e) => set("modelo", e.target.value)}><option>Presencial</option><option>Híbrido</option><option>Remoto</option></select></CampoLabel>
          <CampoLabel label="Tipo"><select style={inp} value={v.tipo} onChange={(e) => set("tipo", e.target.value)}><option>Efetivo</option><option>Temporário</option><option>Estágio</option><option>Aprendiz</option></select></CampoLabel>
        </div>

        <CampoLabel label="Motivo da vaga">
          <select style={inp} value={v.motivo || ""} onChange={(e) => set("motivo", e.target.value)}>
            <option value="">Selecione o motivo</option>
            <option value="Substituição">Substituição</option>
            <option value="Cobrir férias">Cobrir férias</option>
            <option value="Novo setor">Novo setor</option>
            <option value="Aumento de quadro no setor">Aumento de quadro no setor</option>
          </select>
        </CampoLabel>
        <label style={{ display: "flex", gap: 9, alignItems: "center", fontSize: 13, color: ROXO_DARK, marginTop: 6, cursor: "pointer" }}>
          <input type="checkbox" checked={!!v.interna} onChange={(e) => set("interna", e.target.checked)} />
          <strong>Vaga interna</strong> — apenas colaboradores da empresa podem se candidatar (exibe setor/função e tempo de empresa no formulário)
        </label>
        <CampoLabel label="Unidade">
          <select style={inp} value={v.unidade_id || ""} onChange={(e) => set("unidade_id", e.target.value)}>
            <option value="" disabled>Selecione a unidade</option>
            {unidades.map((u: any) => (
              <option key={u.id} value={u.id}>{u.nome}{u.cidade ? ` · ${u.cidade}` : ""}</option>
            ))}
          </select>
          {unidades.length === 0 && <div style={{ fontSize: 11, color: VERMELHO, marginTop: 6 }}>Cadastre uma unidade para esta empresa antes de salvar a vaga.</div>}
        </CampoLabel>
        <div data-grid style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <CampoLabel label="Nº de posições"><input type="number" min={1} style={inp} value={v.vagas} onChange={(e) => set("vagas", Number(e.target.value))} /></CampoLabel>
          <CampoLabel label="Status">
            <select style={inp} value={v.status} onChange={(e) => {
              const val = e.target.value;
              if (val === "Aberta" && !v.formulario_aprovado) {
                alert("Aprove o formulário na Prévia antes de abrir esta vaga.");
                return;
              }
              set("status", val);
            }}>
              <option>Rascunho</option>
              <option disabled={!v.formulario_aprovado}>Aberta{!v.formulario_aprovado ? " (aprove o formulário)" : ""}</option>
              <option>Pausada</option>
              <option>Fechada</option>
            </select>
            {!v.formulario_aprovado && (
              <div style={{ fontSize: 11, color: "#9a6b00", marginTop: 6, display: "flex", alignItems: "center", gap: 5 }}>
                <AlertCircle size={12} /> Para abrir a vaga, aprove o formulário em <strong>Prévia do formulário</strong>.
              </div>
            )}
          </CampoLabel>
        </div>
        <CampoLabel label="Data limite de inscrições (opcional)">
          <input type="date" style={inp} value={v.data_limite || ""} onChange={(e) => set("data_limite", e.target.value || null)} />
          <div style={{ fontSize: 11, color: "#9b93b0", marginTop: 6 }}>Se preencher, a vaga <strong>encerra automaticamente</strong> após essa data.</div>
        </CampoLabel>
        <CampoLabel label="Descrição da vaga"><textarea style={{ ...inp, minHeight: 76, resize: "vertical" }} value={v.descricao} onChange={(e) => set("descricao", e.target.value)} /></CampoLabel>
      </CardBox>

      <CardBox destaque>
        <div data-ai-card style={{ display: "flex", alignItems: "center", gap: 13, flexWrap: "wrap" }}>
          <div style={{ width: 40, height: 40, borderRadius: 11, background: ROXO_TINT, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Wand2 size={20} color={ROXO} /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="h" style={{ fontWeight: 800, fontSize: 15, color: ROXO_DARK }}>Gerar o perfil da vaga com IA</div>
            <div style={{ fontSize: 12.5, color: CINZA, marginTop: 2 }}>A partir dos dados acima, a IA sugere pesos, habilidades, competências, experiência e requisitos — você só ajusta.</div>
          </div>
          <button onClick={gerarIA} disabled={gerando} style={{ background: gerando ? "#D8D2E6" : LARANJA, color: "#fff", border: "none", padding: "11px 18px", borderRadius: 11, fontSize: 14, fontWeight: 700, cursor: gerando ? "default" : "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "inherit", flexShrink: 0, minHeight: 44 }}>
            {gerando ? <><Loader2 size={16} className="spin" /> Gerando...</> : <><Wand2 size={16} /> Gerar com IA</>}
          </button>
        </div>
        {erroIA && <div style={{ marginTop: 10, fontSize: 12.5, color: VERMELHO, fontWeight: 600 }}>{erroIA}</div>}
      </CardBox>

      <CardBox><Cab icon={Target} t="Perfil comportamental ideal" />
        <p style={{ fontSize: 13, color: CINZA, lineHeight: 1.55, margin: "-6px 0 16px" }}>O peso de cada perfil vira a <strong>base do match</strong> de quem for classificado nele pelo DISC.</p>
        {ORDEM_PERFIS.map((k) => {
          const p = PERFIS[k], val = v.pesos[k], [rot, cor] = rotuloPeso(val);
          return (
            <div key={k} data-slider-row style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 0", borderBottom: `1px solid ${BORDA}` }}>
              <div data-slider-label style={{ width: 160, flexShrink: 0 }}>
                <div className="h" style={{ fontWeight: 700, fontSize: 13.5, color: p.cor, display: "flex", alignItems: "center", gap: 5 }}>
                  {p.nome} <InfoDot texto={p.plain} cor={p.cor} />
                </div>
                <div style={{ fontSize: 10.5, color: "#9b93b0", fontWeight: 600 }}>Perfil {p.dim}</div>
              </div>
              <input type="range" min={0} max={100} value={val} onChange={(e) => setPeso(k, Number(e.target.value))} style={{ flex: 1 }} />
              <div data-slider-val style={{ width: 92, textAlign: "right", flexShrink: 0 }}>
                <span className="h" style={{ fontWeight: 800, fontSize: 16, color: cor }}>{val}</span>
                <span style={{ fontSize: 10.5, fontWeight: 700, color: cor, marginLeft: 6 }}>{rot}</span>
              </div>
            </div>
          );
        })}
      </CardBox>

      <CardBox destaque><Cab icon={Calculator} t="Prévia do match" />
        <div style={{ background: ROXO_TINT, borderRadius: 12, padding: 14, marginBottom: 14, fontSize: 12.5, color: ROXO_DARK, lineHeight: 1.5 }}>
          <strong>Com currículo analisado:</strong> match = base × 0,45 + postura × 0,30 + currículo × 0,25.<br/>
          <strong>Sem currículo:</strong> match = base × 0,6 + postura × 0,4.<br/>
          O componente <em>currículo</em> parte da aderência (alta/média/baixa) e desconta lacunas — lacunas de experiência/vivência pesam mais, pois a vaga exige vivência prévia.

        </div>
        <div data-grid style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 16, alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Perfil do candidato (DISC)</div>
            <select style={inp} value={simPerfil} onChange={(e) => setSimPerfil(e.target.value as PerfilKey)}>
              {ORDEM_PERFIS.map((k) => <option key={k} value={k}>{PERFIS[k].nome} → base {v.pesos[k]}</option>)}
            </select>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6 }}>Postura: <strong>{simPostura}</strong></div>
            <input type="range" min={0} max={100} value={simPostura} onChange={(e) => setSimPostura(Number(e.target.value))} style={{ width: "100%" }} />
          </div>
          <div style={{ textAlign: "center", minWidth: 90 }}>
            <div className="h" style={{ fontSize: 34, fontWeight: 800, color: corSim, lineHeight: 1 }}>{matchSim}%</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: corSim }}>{labelMatch(matchSim)}</div>
          </div>
        </div>
      </CardBox>

      <CardBox><Cab icon={Settings2} t="Habilidades" />
        <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
          {v.habilidades.map((h: any, i: number) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px 8px 12px", border: `1px solid ${BORDA}`, borderRadius: 11 }}>
              <span style={{ flex: 1, fontSize: 13.5, color: ROXO_DARK }}>{h.nome}</span>
              <select value={h.nivel} onChange={(e) => setNivelHabValor(i, e.target.value as NivelHab)} style={selNivel(h.nivel)}>
                <option value="essencial">Essencial</option><option value="importante">Importante</option><option value="desejavel">Desejável</option>
              </select>
              <button onClick={() => rmHab(i)} style={{ background: "none", border: "none", cursor: "pointer", color: "#C9C1DC", display: "flex" }}><X size={16} /></button>
            </div>
          ))}
          {v.habilidades.length === 0 && <div style={{ fontSize: 12.5, color: "#9b93b0" }}>Nenhuma habilidade ainda.</div>}
        </div>
        <div data-hab-add style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
          <input style={{ ...inp, flex: "1 1 160px" }} placeholder="Adicionar habilidade..." value={novaHab} onChange={(e) => setNovaHab(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addHab()} />
          <select value={nivelNovaHab} onChange={(e) => setNivelNovaHab(e.target.value as NivelHab)} style={selNivel(nivelNovaHab)}>
            <option value="essencial">Essencial</option><option value="importante">Importante</option><option value="desejavel">Desejável</option>
          </select>
          <button onClick={addHab} style={btnAdd}><Plus size={16} /></button>
        </div>
      </CardBox>

      <CardBox><Cab icon={Layers} t="Competências comportamentais" />
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          {v.competencias.map((c: string, i: number) => (
            <span key={i} style={{ display: "flex", alignItems: "center", gap: 7, background: ROXO_TINT, color: ROXO_DARK, padding: "7px 12px", borderRadius: 99, fontSize: 13, fontWeight: 600 }}>
              {c} <button onClick={() => rmComp(i)} style={{ background: "none", border: "none", cursor: "pointer", color: ROXO, display: "flex", padding: 0 }}><X size={14} /></button>
            </span>
          ))}
          {v.competencias.length === 0 && <div style={{ fontSize: 12.5, color: "#9b93b0" }}>Nenhuma competência ainda.</div>}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input style={inp} placeholder="Adicionar competência..." value={novaComp} onChange={(e) => setNovaComp(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addComp()} />
          <button onClick={addComp} style={btnAdd}><Plus size={16} /></button>
        </div>
      </CardBox>

      <CardBox><Cab icon={GraduationCap} t="Experiência & requisitos" />
        <CampoLabel label="Experiência desejada"><textarea style={{ ...inp, minHeight: 60, resize: "vertical" }} value={v.experiencia} onChange={(e) => set("experiencia", e.target.value)} /></CampoLabel>
        <div data-grid style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <CampoLabel label="Escolaridade mínima"><input style={inp} value={v.escolaridade} onChange={(e) => set("escolaridade", e.target.value)} /></CampoLabel>
          <CampoLabel label="Outros requisitos"><input style={inp} value={v.requisitos} onChange={(e) => set("requisitos", e.target.value)} /></CampoLabel>
        </div>
        <label style={{ display: "flex", gap: 9, alignItems: "center", fontSize: 13, color: ROXO_DARK, marginTop: 6, cursor: "pointer" }}>
          <input type="checkbox" checked={v.usar_situacional} onChange={(e) => set("usar_situacional", e.target.checked)} />
          Incluir o bloco de <strong>situações de atendimento</strong> (vagas com contato direto com cliente)
        </label>
      </CardBox>

      <div data-save-row style={{ display: "flex", justifyContent: "flex-end", gap: 9 }}>
        <button onClick={onCancel} style={{ ...btnSec, padding: "11px 18px", justifyContent: "center" }}>Cancelar</button>
        <button onClick={() => onSave(v)} style={{ background: LARANJA, color: "#fff", border: "none", padding: "11px 20px", borderRadius: 11, fontSize: 14.5, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 7, fontFamily: "inherit", minHeight: 48 }}><Save size={16} /> Salvar vaga</button>
      </div>
    </div>
  );
}

/* ========== Aba Candidatos ========== */
function CandidatosLista({ vagas, vagaSel, setVagaSel, vagaAtual, candidatos, loading, onAbrir }: any) {
  const [busca, setBusca] = useState("");
  const [fPerfil, setFPerfil] = useState("todos");
  const [fMatch, setFMatch] = useState(0);
  const [ordem, setOrdem] = useState("match_desc");

  const lista = useMemo(() => {
    let l = (candidatos as Candidato[]).filter((c) => !vagaSel || c.vaga_id === vagaSel).map((c) => ({ ...c, match: matchDe(vagaAtual, c) }));
    l = l.filter((c) => c.nome.toLowerCase().includes(busca.toLowerCase()) && (fPerfil === "todos" || c.perfil_key === fPerfil) && (c.match ?? 0) >= fMatch);
    l.sort((x, y) => ordem === "match_desc" ? (y.match ?? 0) - (x.match ?? 0) : ordem === "match_asc" ? (x.match ?? 0) - (y.match ?? 0) : ordem === "nome" ? x.nome.localeCompare(y.nome) : new Date(y.created_at).getTime() - new Date(x.created_at).getTime());
    return l;
  }, [candidatos, vagaSel, vagaAtual, busca, fPerfil, fMatch, ordem]);

  const todos = (candidatos as Candidato[]).filter((c) => !vagaSel || c.vaga_id === vagaSel).map((c) => matchDe(vagaAtual, c));
  const matchMedio = todos.length ? Math.round(todos.reduce((s, m) => s + m, 0) / todos.length) : 0;
  const nAlto = todos.filter((m) => m >= 70).length;

  return (
    <>
      <div data-vaga-sel style={{ background: "#fff", border: `1px solid ${BORDA}`, borderRadius: 14, padding: "12px 16px", marginBottom: 14, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: CINZA }}>Vaga:</span>
        <select value={vagaSel || ""} onChange={(e) => setVagaSel(e.target.value)} style={{ ...inp, width: "auto", minWidth: 220, fontWeight: 700, color: ROXO_DARK }}>
          {vagas.map((v: Vaga) => <option key={v.id} value={v.id}>{v.titulo} ({v.status})</option>)}
        </select>
      </div>

      <div data-grid data-resumo style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, marginBottom: 16 }}>
        <ResumoCard icon={Users} cor={ROXO} v={todos.length} l="Inscritos nesta vaga" />
        <ResumoCard icon={TrendingUp} cor={LARANJA} v={`${matchMedio}%`} l="Match médio" />
        <ResumoCard icon={Award} cor={VERDE} v={nAlto} l="Match alto (≥70%)" />
      </div>

      <div data-filtros style={{ background: "#fff", border: `1px solid ${BORDA}`, borderRadius: 14, padding: 14, marginBottom: 14, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
        <div style={{ position: "relative", flex: "1 1 200px" }}>
          <Search size={15} color="#9b93b0" style={{ position: "absolute", left: 11, top: 11 }} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nome..." style={{ ...inp, padding: "9px 12px 9px 32px" }} />
        </div>
        <Sel val={fPerfil} on={setFPerfil} ops={[["todos", "Todos os perfis"], ...Object.entries(PERFIS).map(([k, p]) => [k, p.nome] as [string, string])]} />
        <Sel val={String(fMatch)} on={(v) => setFMatch(Number(v))} ops={[["0", "Qualquer match"], ["55", "Match ≥ 55%"], ["70", "Match ≥ 70%"], ["85", "Match ≥ 85%"]]} />
        <Sel val={ordem} on={setOrdem} ops={[["match_desc", "Maior match"], ["match_asc", "Menor match"], ["recentes", "Mais recentes"], ["nome", "Nome (A-Z)"]]} />
      </div>

      <div style={{ fontSize: 12, color: CINZA, marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}><Filter size={13} /> {lista.length} candidato(s)</div>

      <div style={{ display: "grid", gap: 9 }}>
        {loading && <div style={{ textAlign: "center", color: CINZA, padding: 30 }}>Carregando...</div>}
        {!loading && lista.map((c: any) => {
          const p = c.perfil_key && (PERFIS as any)[c.perfil_key];
          const match = c.match ?? 0;
          return (
            <button type="button" key={c.id} onClick={() => onAbrir(c)} data-cand-row style={{
              display: "flex", alignItems: "center", gap: 14, textAlign: "left", cursor: "pointer", fontFamily: "inherit",
              background: "#fff", border: `1px solid ${BORDA}`, borderRadius: 13, padding: "13px 16px", width: "100%",
            }}>
              <div style={{ width: 42, height: 42, borderRadius: 99, background: ROXO_TINT, color: ROXO, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 15, flexShrink: 0 }} className="h">
                {c.nome.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}
              </div>
              <div data-cand-main style={{ flex: 1, minWidth: 0 }}>
                <div className="h" style={{ fontWeight: 700, fontSize: 15, color: ROXO_DARK }}>{c.nome}</div>
                <div style={{ fontSize: 12, color: "#9b93b0", display: "flex", gap: 10, marginTop: 2, flexWrap: "wrap" }}>
                  <span>{c.setor_atual || "—"}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 3 }}><Calendar size={11} /> {new Date(c.created_at).toLocaleDateString("pt-BR")}</span>
                </div>
              </div>
              {p && <span data-cand-perfil style={{ fontSize: 11.5, fontWeight: 700, color: "#fff", background: p.cor, padding: "4px 10px", borderRadius: 99, flexShrink: 0 }}>{p.nome}</span>}
              <div data-cand-match style={{ textAlign: "right", flexShrink: 0, minWidth: 70 }}>
                <div className="h" style={{ fontSize: 19, fontWeight: 800, color: corMatch(match) }}>{match}%</div>
                <div style={{ fontSize: 10.5, fontWeight: 600, color: corMatch(match) }}>{labelMatch(match)}</div>
              </div>
              <ChevronRight data-cand-arrow size={18} color="#C9C1DC" />
            </button>
          );
        })}
        {!loading && lista.length === 0 && <div style={{ textAlign: "center", color: CINZA, padding: 30, fontSize: 14 }}>Nenhum candidato com esses filtros.</div>}
      </div>
    </>
  );
}

/* ========== Detalhe candidato ========== */
function Detalhe({ c, vaga, onClose }: { c: Candidato; vaga: Vaga | null; onClose: () => void }) {
  const p = c.perfil_key ? (PERFIS as any)[c.perfil_key] : null;
  const match = vaga ? matchDe(vaga, c) : (c.match_final ?? 0);
  const disc = c.disc_pontuacao || {};
  const cv = c.cv_analise;
  const [cvUrl, setCvUrl] = useState<string | null>(null);
  const [cvMime, setCvMime] = useState<string>("");

  useEffect(() => {
    if (!c.cv_storage_path) return;
    let revoke: string | null = null;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.storage.from("curriculos").download(c.cv_storage_path!);
      if (error || !data || cancelled) return;
      const path = c.cv_storage_path!.toLowerCase();
      const ext = path.split(".").pop() || "";
      const mimeByExt: Record<string, string> = {
        pdf: "application/pdf",
        png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp",
        heic: "image/heic", heif: "image/heif", gif: "image/gif",
        doc: "application/msword",
        docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        odt: "application/vnd.oasis.opendocument.text",
        txt: "text/plain",
      };
      const mime = data.type && data.type !== "application/octet-stream" ? data.type : (mimeByExt[ext] || "application/octet-stream");
      const blob = new Blob([data], { type: mime });
      const url = URL.createObjectURL(blob);
      revoke = url;
      setCvUrl(url);
      setCvMime(mime);
    })();
    return () => { cancelled = true; if (revoke) URL.revokeObjectURL(revoke); };
  }, [c.cv_storage_path]);


  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(58,37,102,.45)", display: "flex", justifyContent: "flex-end", zIndex: 50 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(560px,100%)", background: "#FBFAFE", height: "100%", overflowY: "auto", boxShadow: "-10px 0 40px rgba(0,0,0,.2)" }}>
        <div style={{ background: ROXO, padding: "18px 22px", display: "flex", alignItems: "center", gap: 13, position: "sticky", top: 0, zIndex: 2 }}>
          <div style={{ width: 46, height: 46, borderRadius: 99, background: "#fff", color: ROXO, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 16 }} className="h">
            {c.nome.split(" ").map((n) => n[0]).slice(0, 2).join("")}
          </div>
          <div style={{ flex: 1 }}>
            <div className="h" style={{ color: "#fff", fontWeight: 800, fontSize: 19 }}>{c.nome}</div>
            <div style={{ color: "#fff", opacity: 0.85, fontSize: 12.5 }}>{c.setor_atual || "—"}{vaga ? ` · ${vaga.titulo}` : ""}</div>
          </div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,.18)", border: "none", borderRadius: 9, width: 34, height: 34, cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={18} /></button>
        </div>

        <div style={{ padding: 20 }}>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", fontSize: 13, color: CINZA, marginBottom: 18 }}>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Mail size={14} color={ROXO} /> {c.email}</span>
            <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Phone size={14} color={ROXO} /> {c.celular}</span>
          </div>

          <Bloco>
            <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <div style={{ fontSize: 12, color: CINZA, fontWeight: 600 }}>Perfil comportamental</div>
                <div className="h" style={{ fontSize: 23, fontWeight: 800, color: p?.cor ?? ROXO, lineHeight: 1.1, margin: "3px 0" }}>{p?.nome ?? c.perfil_nome ?? "—"}</div>
                {p && <span style={{ fontSize: 11.5, fontWeight: 700, background: ROXO_TINT, color: ROXO, padding: "3px 9px", borderRadius: 99 }}>{p.tag}</span>}
              </div>
              <Ring m={match} />
            </div>
            <div style={{ marginTop: 14 }}>
              {(Object.keys(DIM_INFO) as Array<keyof typeof DIM_INFO>).map((d) => (
                <div key={d} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 7 }}>
                  <div style={{ width: 110, fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>{DIM_INFO[d].nome} <InfoDot texto={DIM_INFO[d].plain} cor={DIM_INFO[d].cor} /></div>
                  <div style={{ flex: 1, height: 13, background: "#F0EDF7", borderRadius: 9, overflow: "hidden" }}>
                    <div style={{ height: 13, width: `${disc[d] ?? 0}%`, background: DIM_INFO[d].cor, borderRadius: 9 }} />
                  </div>
                  <div style={{ width: 34, textAlign: "right", fontSize: 12, fontWeight: 700, color: DIM_INFO[d].cor }}>{disc[d] ?? 0}%</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <MiniDet l="Postura no atendimento" v={`${c.postura_score ?? 0}%`} />
              <MiniDet l="Aderência à vaga" v={`${match}%`} />
            </div>
          </Bloco>

          {c.cv_storage_path && (
            <Bloco>
              <Cab icon={FileText} t="Currículo enviado" />
              <div style={{ fontSize: 13, color: CINZA, marginBottom: 10 }}>📎 {c.cv_nome_arquivo || "currículo.pdf"}</div>
              {cvUrl ? (() => {
                const ehPdf = cvMime === "application/pdf";
                const ehImg = cvMime.startsWith("image/");
                const ehTxt = cvMime.startsWith("text/");
                const nomeArq = c.cv_nome_arquivo || ((c.cv_storage_path || "").split("/").pop() ?? "curriculo");
                return (
                  <>
                    {ehPdf && (
                      <div style={{ border: `1px solid ${BORDA}`, borderRadius: 11, overflow: "hidden", marginBottom: 10, background: "#F0EDF7" }}>
                        <object data={cvUrl} type="application/pdf" style={{ width: "100%", height: 460, display: "block" }}>
                          <iframe src={cvUrl} title="Currículo" style={{ width: "100%", height: 460, border: "none", display: "block" }} />
                        </object>
                      </div>
                    )}
                    {ehImg && (
                      <div style={{ border: `1px solid ${BORDA}`, borderRadius: 11, overflow: "hidden", marginBottom: 10, background: "#F0EDF7", textAlign: "center" }}>
                        <img src={cvUrl} alt="Currículo" style={{ maxWidth: "100%", maxHeight: 480, display: "block", margin: "0 auto" }} />
                      </div>
                    )}
                    {ehTxt && (
                      <div style={{ border: `1px solid ${BORDA}`, borderRadius: 11, overflow: "hidden", marginBottom: 10, background: "#fff" }}>
                        <iframe src={cvUrl} title="Currículo" style={{ width: "100%", height: 360, border: "none", display: "block" }} />
                      </div>
                    )}
                    {!ehPdf && !ehImg && !ehTxt && (
                      <div style={{ background: ROXO_TINT, border: `1px solid ${ROXO}33`, borderRadius: 11, padding: 12, fontSize: 12.5, color: ROXO_DARK, marginBottom: 10 }}>
                        Não há preview embutido para este tipo de arquivo. Use os botões abaixo para abrir ou baixar.
                      </div>
                    )}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                      <a href={cvUrl} target="_blank" rel="noreferrer" style={{ background: ROXO, color: "#fff", padding: "8px 14px", borderRadius: 9, fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>
                        Abrir em nova aba
                      </a>
                      <a href={cvUrl} download={nomeArq} style={{ background: "#fff", color: ROXO, border: `1.5px solid ${BORDA}`, padding: "8px 14px", borderRadius: 9, fontSize: 12.5, fontWeight: 700, textDecoration: "none" }}>
                        Baixar
                      </a>
                    </div>
                  </>
                );
              })() : (
                <div style={{ fontSize: 12, color: CINZA }}>Carregando arquivo...</div>
              )}
              <div style={{ fontSize: 11, color: "#9b93b0", marginTop: 8 }}>Arquivo armazenado de forma privada — baixado para visualização local.</div>

            </Bloco>
          )}

          {cv && (
            <Bloco>
              <Cab icon={FileText} t="Análise de currículo (IA)" />
              <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "0 0 10px" }}>
                <span style={{ fontSize: 12.5, color: CINZA, fontWeight: 600 }}>Aderência do histórico:</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: corNivel(cv.aderencia_televendas), padding: "2px 9px", borderRadius: 99 }}>{txtNivel(cv.aderencia_televendas)}</span>
                {cv.anos_relevantes && <span style={{ fontSize: 12, color: "#9b93b0" }}>· {cv.anos_relevantes}</span>}
              </div>
              <p style={{ fontSize: 13.5, lineHeight: 1.6, color: ROXO_DARK, margin: "0 0 14px" }}>{cv.resumo}</p>
              {(cv.experiencias || []).map((e: any, i: number) => (
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 11px", border: `1px solid ${BORDA}`, borderRadius: 10, marginBottom: 6, background: "#fff" }}>
                  <div><div style={{ fontSize: 13, fontWeight: 600 }}>{e.cargo} · {e.empresa}</div><div style={{ fontSize: 11, color: "#9b93b0" }}>{e.periodo}</div></div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: corNivel(e.relevancia), padding: "2px 9px", borderRadius: 99 }}>{txtNivel(e.relevancia)}</span>
                </div>
              ))}
              <div data-grid style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}>
                <BoxList t="Pontos fortes" icon={Star} cor={VERDE} items={cv.pontos_fortes} />
                <BoxList t="Lacunas" icon={AlertCircle} cor={LARANJA} items={cv.lacunas} />
              </div>
              {(cv.perguntas_entrevista || []).length > 0 && (
                <div style={{ marginTop: 12, background: ROXO_TINT, borderRadius: 11, padding: 13 }}>
                  <div className="h" style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 12.5, margin: "0 0 8px", color: ROXO }}><Lightbulb size={14} color={ROXO} /> Sugestões para a entrevista</div>
                  {cv.perguntas_entrevista.map((q: string, i: number) => <div key={i} style={{ fontSize: 12.5, color: CINZA, marginBottom: 5, display: "flex", gap: 6 }}><span style={{ color: ROXO }}>{i + 1}.</span> {q}</div>)}
                </div>
              )}
            </Bloco>
          )}

          {!cv && c.cv_storage_path && (
            <Bloco>
              <Cab icon={FileText} t="Análise de currículo (IA)" />
              <div style={{ fontSize: 12.5, color: CINZA, lineHeight: 1.55 }}>
                Análise automática não disponível para esta inscrição. Isso pode acontecer se o candidato fechou a página antes da IA terminar de processar o currículo. O arquivo continua acessível acima.
              </div>
            </Bloco>
          )}


          <div style={{ display: "flex", gap: 9, alignItems: "center", fontSize: 11.5, color: "#9b93b0", marginTop: 4 }}>
            <ShieldCheck size={14} /> Dados de diversidade não são exibidos nesta ficha (LGPD / antidiscriminação).
          </div>
        </div>
      </div>
    </div>
  );
}

function Diversidade({ rows, loading }: { rows: DivRow[]; loading: boolean }) {
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

/* ====== utilitários visuais ====== */
const btnSec: React.CSSProperties = { background: "#fff", color: ROXO, border: `1.5px solid ${BORDA}`, padding: "9px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" };
const btnPri: React.CSSProperties = { background: ROXO, color: "#fff", border: "none", padding: "9px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" };
const btnEnc: React.CSSProperties = { background: "#fff", color: VERMELHO, border: `1.5px solid ${VERMELHO}55`, padding: "9px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" };
const btnAdd: React.CSSProperties = { background: ROXO, color: "#fff", border: "none", padding: "10px 14px", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", fontFamily: "inherit" };
const selNivel = (n: string): React.CSSProperties => ({ padding: "6px 10px", borderRadius: 8, border: `1.5px solid ${BORDA}`, fontSize: 12, fontWeight: 700, color: n === "essencial" ? VERMELHO : n === "importante" ? LARANJA : "#7C7791", background: "#fff", cursor: "pointer", fontFamily: "inherit" });

function CardBox({ children, destaque }: any) {
  return <div style={{ background: "#fff", border: `1px solid ${destaque ? ROXO + "33" : BORDA}`, borderRadius: 14, padding: 18, boxShadow: destaque ? "0 8px 24px -16px rgba(80,50,138,.25)" : undefined }}>{children}</div>;
}
function Cab({ icon: Icon, t }: any) { return <div className="h" style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 15, marginBottom: 12, color: ROXO_DARK }}><Icon size={17} color={ROXO} /> {t}</div>; }
function CampoLabel({ label, children }: any) {
  return <label style={{ display: "block", marginBottom: 14 }}>
    <span style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: ROXO_DARK, marginBottom: 6 }}>{label}</span>
    {children}
  </label>;
}
function InfoDot({ texto, cor }: { texto: string; cor: string }) {
  return <span title={texto} style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 14, height: 14, borderRadius: 99, background: cor + "22", color: cor, cursor: "help" }}><Info size={9} /></span>;
}
function ResumoCard({ icon: Icon, cor, v, l }: any) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${BORDA}`, borderRadius: 14, padding: 16 }}>
      <div style={{ width: 34, height: 34, borderRadius: 9, background: cor + "18", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 9 }}><Icon size={18} color={cor} /></div>
      <div className="h" style={{ fontSize: 24, fontWeight: 800, color: ROXO_DARK, lineHeight: 1 }}>{v}</div>
      <div style={{ fontSize: 12, color: CINZA, marginTop: 3 }}>{l}</div>
    </div>
  );
}
function Sel({ val, on, ops }: { val: string; on: (v: string) => void; ops: [string, string][] }) {
  return <select value={val} onChange={(e) => on(e.target.value)} style={{ padding: "9px 12px", border: `1.5px solid ${BORDA}`, borderRadius: 10, fontSize: 13, fontFamily: "inherit", color: ROXO_DARK, background: "#fff", cursor: "pointer" }}>
    {ops.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
  </select>;
}
function Bloco({ children }: any) { return <div style={{ background: "#fff", border: `1px solid ${BORDA}`, borderRadius: 14, padding: 16, marginBottom: 14 }}>{children}</div>; }
function BoxList({ t, icon: Icon, cor, items }: any) {
  return (
    <div style={{ background: ROXO_TINT, borderRadius: 11, padding: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontWeight: 700, fontSize: 12, color: cor, marginBottom: 8 }}><Icon size={13} /> {t}</div>
      {(items || []).map((x: string, i: number) => <div key={i} style={{ fontSize: 12, color: CINZA, marginBottom: 5, display: "flex", gap: 6 }}><span style={{ color: cor }}>•</span> {x}</div>)}
    </div>
  );
}
function MiniDet({ l, v }: any) {
  return <div style={{ flex: 1, border: `1px solid ${BORDA}`, borderRadius: 11, padding: "10px 13px" }}>
    <div style={{ fontSize: 11.5, color: CINZA, fontWeight: 600 }}>{l}</div>
    <div className="h" style={{ fontSize: 20, fontWeight: 800, color: ROXO, lineHeight: 1.1, marginTop: 2 }}>{v}</div>
  </div>;
}
function Ring({ m }: { m: number }) {
  const r = 32, c = 2 * Math.PI * r, cor = corMatch(m);
  return (
    <div style={{ textAlign: "center" }}>
      <svg width="86" height="86" viewBox="0 0 86 86">
        <circle cx="43" cy="43" r={r} fill="none" stroke="#EEEAF6" strokeWidth="8" />
        <circle cx="43" cy="43" r={r} fill="none" stroke={cor} strokeWidth="8" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (c * m) / 100} transform="rotate(-90 43 43)" />
        <text x="43" y="40" textAnchor="middle" fontSize="21" fontWeight="800" fill={cor} fontFamily="Outfit">{m}%</text>
        <text x="43" y="54" textAnchor="middle" fontSize="8.5" fill="#888">match</text>
      </svg>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: cor, marginTop: -3 }}>{labelMatch(m)}</div>
    </div>
  );
}
