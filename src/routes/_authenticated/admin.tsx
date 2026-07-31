import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search, Users, TrendingUp, Award, ChevronRight, ChevronLeft, X, Phone, Mail,
  Briefcase, Star, AlertCircle, Lightbulb, BarChart3, ShieldCheck, Calendar, Headphones,
  Filter, FileText, LogOut, Plus, Save, Pencil, Ban, CalendarClock, Wand2, Loader2,
  Circle, Info, Link2, Copy, Check, Target, Layers, GraduationCap, Settings2, Calculator,
  Crown, Building2, ChevronDown, RefreshCw, UserCog, Trash2, Printer,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { gerarPerfilVaga, excluirVaga } from "@/lib/recrutamento.functions";
import { sincronizarCompetenciasVaga } from "@/lib/qinmatch.functions";
import { encerrarVaga as encerrarVagaFn, listCandidatosDaVaga, getContratacaoByVaga, reenviarAvaliacao, marcarAvaliacaoRespondida } from "@/lib/encerramento.functions";
import { selecionarParaEntrevista, removerEntrevista } from "@/lib/jornada.functions";
import { listLideresDaVaga } from "@/lib/lideres.functions";
import { atualizarCadastroCandidato, excluirCandidato } from "@/lib/candidato.functions";
import { getMyScope } from "@/lib/scope.functions";
import { useFeatures } from "@/lib/recrutamento/use-features";
import { PassaporteBloco } from "@/components/PassaporteBloco";
import { QinMatchBloco } from "@/components/QinMatchBloco";
import { EntrevistaBloco } from "@/components/EntrevistaBloco";
import { useServerFn } from "@tanstack/react-start";
import {
  ROXO, ROXO_DARK, ROXO_TINT, LARANJA, LARANJA_TINT, CINZA, BORDA, VERDE, VERMELHO, AMARELO,
  PERFIS, DIM_INFO, ORDEM_PERFIS, labelMatch, corMatch, corNivel, txtNivel,
  matchDe, statusVaga, efetivamenteEncerrada, fmtData, rotuloPeso, novaVagaVazia,
  type Vaga, type PerfilKey, type NivelHab,
} from "@/lib/recrutamento/data";
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, BarChart as RBarChart, Bar as RBar, XAxis, YAxis, Cell, LabelList,
} from "recharts";
import { AnimatedStatsCard } from "@/components/ui/animated-stats-card";

type AdminSearch = { empresa?: string };

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Painel do Recrutador · Estrela" }] }),
  validateSearch: (s: Record<string, unknown>): AdminSearch => ({
    empresa: typeof s.empresa === "string" ? s.empresa : undefined,
  }),
  component: AdminPage,
});

export type Candidato = {
  id: string; created_at: string; vaga_id: string | null;
  nome: string; email: string; celular: string; setor_atual: string | null;
  tempo_empresa?: string | null; endereco?: string | null;
  perfil_key: string | null; perfil_nome: string | null;
  match_final: number | null; match_label: string | null; postura_score: number | null;
  disc_pontuacao: any; cv_analise: any; cv_storage_path: string | null; cv_nome_arquivo: string | null;
  experiencia_texto: string | null;
  etapa?: "inscrito" | "entrevista" | "contratado" | "nao_contratado" | null;
  entrevista_data?: string | null;
  entrevista_obs?: string | null;
  nao_contratado_motivo?: "vaga_preenchida" | "encerramento_insucesso" | null;
};

const inp: React.CSSProperties = { width: "100%", padding: "10px 12px", border: `1.5px solid ${BORDA}`, borderRadius: 10, fontSize: 13.5, outline: "none", background: "#fff", color: ROXO_DARK, fontFamily: "inherit" };

function AdminPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [aba, setAba] = useState<"vagas" | "candidatos">("vagas");
  const [editando, setEditando] = useState<Vaga | null>(null);
  const [vagaSel, setVagaSel] = useState<string | null>(null);
  
  const qc = useQueryClient();

  const fetchScope = useServerFn(getMyScope);
  const excluirVagaFn = useServerFn(excluirVaga);
  const syncCompVaga = useServerFn(sincronizarCompetenciasVaga);
  const scopeQ = useQuery({ queryKey: ["my-scope"], queryFn: () => fetchScope() });
  const scope = scopeQ.data;
  const isSuper = scope?.role === "super_admin";
  const { has } = useFeatures(); // entitlements da empresa ativa

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
      aceita_inscricao_publica: (v as any).aceita_inscricao_publica ?? true,
      motivo: (v as any).motivo ?? "",
      departamento_id: (v as any).departamento_id,
      setor_id: (v as any).setor_id,
    };
    if ((v as any).unidade_id) payload.unidade_id = (v as any).unidade_id;
    let vagaId: string | undefined = (v as any).id;
    if (vagaId) {
      const { error } = await supabase.from("vagas").update(payload).eq("id", vagaId);
      if (error) { alert("Erro ao salvar: " + error.message); return; }
    } else {
      if (!empresaAtivaId) { alert("Selecione uma empresa antes de criar a vaga."); return; }
      const unidadeId = (v as any).unidade_id || unidadePadraoId;
      if (!unidadeId) { alert("Cadastre ou selecione uma unidade antes de criar a vaga."); return; }
      const { data: nova, error } = await supabase.from("vagas").insert({ ...payload, empresa_id: empresaAtivaId, unidade_id: unidadeId }).select("id").single();
      if (error) { alert("Erro ao criar: " + error.message); return; }
      vagaId = (nova as any)?.id;
    }
    // Sincroniza as competências da vaga (vaga_competencias) — caminho rico do QinMatch.
    if (vagaId) {
      try {
        await syncCompVaga({ data: { vagaId, habilidades: (v.habilidades ?? []) as any } });
      } catch (e: any) {
        alert("Vaga salva, mas falhou ao sincronizar competências para o match: " + (e?.message || e));
      }
    }
    setEditando(null);
    qc.invalidateQueries({ queryKey: ["vagas"] });
  }

  const [encerrarVagaId, setEncerrarVagaId] = useState<string | null>(null);
  function encerrarVaga(id: string) { setEncerrarVagaId(id); }
  async function handleExcluirVaga(id: string) {
    if (!confirm("Tem certeza que deseja EXCLUIR permanentemente esta vaga?\n\nEsta ação não pode ser desfeita e todos os candidatos vinculados serão perdidos.")) return;
    try {
      await excluirVagaFn({ data: { vagaId: id } });
      qc.invalidateQueries({ queryKey: ["vagas"] });
    } catch (e: any) {
      alert(e.message || "Erro ao excluir vaga.");
    }
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
        <div style={{ lineHeight: 1, minWidth: 0 }}>
          <div data-header-sub className="h" style={{ color: "#fff", fontWeight: 700, letterSpacing: 2, fontSize: 10.5, opacity: 0.85 }}>
            {empresaAtiva?.nome?.toUpperCase() || "DISTRIBUIDORA ESTRELA"}
          </div>
          <div className="h" style={{ color: "#fff", fontWeight: 800, fontSize: 17 }}>Painel do Recrutador</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 8, alignItems: "center", color: "#fff", flexWrap: "wrap" }}>
          {isSuper && (
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
          )}
          <span data-header-sub style={{ fontSize: 12, opacity: 0.8, display: "flex", alignItems: "center", gap: 6 }}><Headphones size={15} /> Recrutamento interno</span>
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
          {([["vagas", "Vagas", Briefcase], ["candidatos", "Candidatos", Users]] as const)
            .map(([k, t, Ic]) => (
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
          ? <ConstrutorVaga vaga={editando} empresaId={empresaAtivaId} unidades={unidadesQ.data ?? []} onSave={salvarVaga} onCancel={() => setEditando(null)} has={has} />

          : <VagasLista vagas={vagas} loading={vagasQ.isLoading} contagem={contagem} isSuper={isSuper}
              onPrevia={(v: Vaga) => navigate({ to: "/previa/$id", params: { id: v.id } })}
              onNova={() => setEditando({ ...(novaVagaVazia() as any), id: undefined, unidade_id: unidadePadraoId ?? undefined } as any)}
              onEditar={(v: Vaga) => setEditando(v)}
              onVerCand={(v: Vaga) => { setVagaSel(v.id); setAba("candidatos"); }}
              onEncerrar={encerrarVaga}
              onExcluir={handleExcluirVaga} />
        )}

        {aba === "candidatos" && (
          <CandidatosLista vagas={vagas} vagaSel={vagaSel} setVagaSel={setVagaSel} vagaAtual={vagaAtual}
            candidatos={candidatosQ.data ?? []} loading={candidatosQ.isLoading}
            onAbrir={(c: Candidato) => navigate({ to: "/candidato/$id", params: { id: c.id } })} />
        )}

      </div>


      {encerrarVagaId && (
        <EncerrarVagaModal
          vagaId={encerrarVagaId}
          onClose={() => setEncerrarVagaId(null)}
          onDone={() => { setEncerrarVagaId(null); qc.invalidateQueries({ queryKey: ["vagas"] }); qc.invalidateQueries({ queryKey: ["contratacao"] }); }}
        />
      )}
    </div>
  );
}

/* ========== Aba Vagas — Lista ========== */
function VagasLista({ vagas, loading, contagem, onNova, onEditar, onVerCand, onEncerrar, onPrevia, isSuper, onExcluir }: any) {
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
              {efetivamenteEncerrada(v) && <ContratacaoCard vagaId={v.id} />}
              <div data-vaga-actions style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap" }}>
                <button onClick={() => onEditar(v)} style={btnSec}><Pencil size={14} /> Editar perfil</button>
                <button onClick={() => onPrevia(v)} style={btnSec}><FileText size={14} /> Prévia do formulário</button>
                <button onClick={() => onVerCand(v)} style={btnPri}><Users size={14} /> Ver candidatos <ChevronRight size={15} /></button>
                {!efetivamenteEncerrada(v) && <button onClick={() => onEncerrar(v.id)} style={btnEnc}><Ban size={14} /> Encerrar vaga</button>}
                {isSuper && <button onClick={() => onExcluir(v.id)} style={btnDel}><Trash2 size={14} /> Excluir</button>}
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
function ConstrutorVaga({ vaga, empresaId, unidades, onSave, onCancel, has }: { vaga: any; empresaId: string | null; unidades: any[]; onSave: (v: any) => void; onCancel: () => void; has: (k: import("@/lib/recrutamento/features").FeatureKey) => boolean }) {
  const [v, setV] = useState<any>(vaga);
  const set = (k: string, val: any) => setV((p: any) => ({ ...p, [k]: val }));
  const [novaHab, setNovaHab] = useState("");
  const [nivelNovaHab, setNivelNovaHab] = useState<NivelHab>("importante");
  const [nivelMinNovaHab, setNivelMinNovaHab] = useState<number>(3);
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
  const setNivelMinHab = (i: number, nivel_min: number) => setV((p: any) => { const h = [...p.habilidades]; h[i] = { ...h[i], nivel_min }; return { ...p, habilidades: h }; });

  const addHab = () => { if (novaHab.trim()) { setV((p: any) => ({ ...p, habilidades: [...p.habilidades, { nome: novaHab.trim(), nivel: nivelNovaHab, nivel_min: nivelMinNovaHab }] })); setNovaHab(""); } };
  const rmHab = (i: number) => setV((p: any) => ({ ...p, habilidades: p.habilidades.filter((_: any, j: number) => j !== i) }));
  const addComp = () => { if (novaComp.trim()) { setV((p: any) => ({ ...p, competencias: [...p.competencias, novaComp.trim()] })); setNovaComp(""); } };
  const rmComp = (i: number) => setV((p: any) => ({ ...p, competencias: p.competencias.filter((_: any, j: number) => j !== i) }));

  async function gerarIA() {
    if (!v.titulo.trim()) { setErroIA("Preencha ao menos o título da vaga antes de gerar."); return; }
    setGerando(true); setErroIA("");
    try {
      const g: any = await gerarPerfilVaga({ data: { titulo: v.titulo, setor: v.setor, modelo: v.modelo, tipo: v.tipo, descricao: v.descricao, empresaId } });
      const pesosNum = Object.fromEntries(Object.entries(g.pesos || {}).map(([k, val]) => [k, Math.max(0, Math.min(100, Number(val) || 0))]));
      // A IA devolve {nome, tipo, peso, nivel_min}; o objeto habilidade usa `nivel` = peso.
      const habsIA = Array.isArray(g.habilidades)
        ? g.habilidades.filter((h: any) => h?.nome).map((h: any) => ({
            nome: String(h.nome).trim(),
            nivel: ["essencial", "importante", "desejavel"].includes(h.peso) ? h.peso : (["essencial", "importante", "desejavel"].includes(h.nivel) ? h.nivel : "importante"),
            nivel_min: typeof h.nivel_min === "number" ? Math.min(5, Math.max(1, Math.round(h.nivel_min))) : 3,
            tipo: ["tecnica", "comportamental", "transversal"].includes(h.tipo) ? h.tipo : undefined,
          }))
        : [];
      setV((p: any) => ({
        ...p, pesos: { ...p.pesos, ...pesosNum },
        descricao: (typeof g.descricao === "string" && g.descricao.trim()) ? g.descricao.trim() : p.descricao,
        habilidades: habsIA.length ? habsIA : p.habilidades,
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
        {has("inscricao_publica") && (
          <label style={{ display: "flex", gap: 9, alignItems: "center", fontSize: 13, color: ROXO_DARK, marginTop: 10, cursor: "pointer" }}>
            <input type="checkbox" checked={(v as any).aceita_inscricao_publica ?? true} onChange={(e) => set("aceita_inscricao_publica", e.target.checked)} />
            <span><strong>Aceitar inscrição por link público</strong> — libera o formulário (link) para candidatos se inscreverem. Desligado, o link responde "inscrições não abertas".</span>
          </label>
        )}
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

      {has("analise_cv_ia") && (
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
      )}

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
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 10px 8px 12px", border: `1px solid ${BORDA}`, borderRadius: 11, flexWrap: "wrap" }}>
              <span style={{ flex: "1 1 130px", fontSize: 13.5, color: ROXO_DARK }}>{h.nome}</span>
              <select value={h.nivel} onChange={(e) => setNivelHabValor(i, e.target.value as NivelHab)} style={selNivel(h.nivel)}>
                <option value="essencial">Essencial</option><option value="importante">Importante</option><option value="desejavel">Desejável</option>
              </select>
              <select value={h.nivel_min ?? 3} onChange={(e) => setNivelMinHab(i, Number(e.target.value))} style={selMin} title="Nível mínimo exigido (1 a 5)">
                {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>Nível {n}</option>)}
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
          <select value={nivelMinNovaHab} onChange={(e) => setNivelMinNovaHab(Number(e.target.value))} style={selMin} title="Nível mínimo exigido (1 a 5)">
            {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>Nível {n}</option>)}
          </select>
          <button onClick={addHab} style={btnAdd}><Plus size={16} /></button>
        </div>
        <div style={{ fontSize: 11, color: "#9b93b0", marginTop: 8 }}>
          <strong>Peso</strong> = prioridade da competência · <strong>Nível</strong> = proficiência mínima exigida (1 básico → 5 especialista). Alimenta o QinMatch.
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
        {has("situacional") && (
        <label style={{ display: "flex", gap: 9, alignItems: "center", fontSize: 13, color: ROXO_DARK, marginTop: 6, cursor: "pointer" }}>
          <input type="checkbox" checked={v.usar_situacional} onChange={(e) => set("usar_situacional", e.target.checked)} />
          Incluir o bloco de <strong>situações de atendimento</strong> (vagas com contato direto com cliente)
        </label>
        )}
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


function imprimirAnaliseCv(c: Candidato, vaga: Vaga | null, cv: any) {
  const esc = (s: any) => String(s ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" } as any)[m]);
  const nivelTxt = (n: string) => ({ alta: "Alta", media: "Média", baixa: "Baixa" } as any)[String(n || "").toLowerCase()] || (n || "—");
  const nivelCor = (n: string) => ({ alta: "#16a34a", media: "#eab308", baixa: "#dc2626" } as any)[String(n || "").toLowerCase()] || "#6b7280";

  const match = vaga ? matchDe(vaga, c) : (c.match_final ?? 0);
  const perfil = c.perfil_key ? (PERFIS as any)[c.perfil_key] : null;
  const disc = c.disc_pontuacao || {};
  const dims: Array<"D"|"I"|"S"|"C"> = ["D","I","S","C"];

  const discBars = dims.map((d) => {
    const v = Number(disc[d] ?? 0);
    const info = DIM_INFO[d];
    return `<div class="dimrow">
      <div class="dimhead"><span><b style="color:${info.cor}">${info.nome}</b> <span class="m">(${d})</span></span><span class="dimval">${v}%</span></div>
      <div class="bar"><div class="fill" style="width:${Math.max(2, v)}%;background:${info.cor}"></div></div>
      <div class="m dimplain">${esc(info.plain)}</div>
    </div>`;
  }).join("");

  const exp = cv ? (cv.experiencias || []).map((e: any) => `
    <div class="exp"><div><div class="b">${esc(e.cargo)} · ${esc(e.empresa)}</div><div class="m">${esc(e.periodo || "")}</div></div>
    <span class="tag" style="background:${nivelCor(e.relevancia)}">${esc(nivelTxt(e.relevancia))}</span></div>`).join("") : "";
  const lista = (arr: string[] | undefined, cor: string) => (arr || []).map((x) => `<li><span style="color:${cor}">●</span> ${esc(x)}</li>`).join("");
  const perg = cv ? (cv.perguntas_entrevista || []).map((q: string, i: number) => `<div class="q"><b>${i + 1}.</b> ${esc(q)}</div>`).join("") : "";

  const dados = `
    <div class="kvs">
      ${c.email ? `<div class="kv"><span class="k">E-mail</span><span class="v">${esc(c.email)}</span></div>` : ""}
      ${c.celular ? `<div class="kv"><span class="k">Celular</span><span class="v">${esc(c.celular)}</span></div>` : ""}
      ${c.endereco ? `<div class="kv"><span class="k">Endereço</span><span class="v">${esc(c.endereco)}</span></div>` : ""}
      ${c.setor_atual ? `<div class="kv"><span class="k">Setor atual</span><span class="v">${esc(c.setor_atual)}</span></div>` : ""}
      ${c.tempo_empresa ? `<div class="kv"><span class="k">Tempo na empresa</span><span class="v">${esc(c.tempo_empresa)}</span></div>` : ""}
      ${vaga ? `<div class="kv"><span class="k">Vaga</span><span class="v">${esc(vaga.titulo)}</span></div>` : ""}
      <div class="kv"><span class="k">Inscrição em</span><span class="v">${esc(fmtData(c.created_at))}</span></div>
    </div>`;

  const matchCor = corMatch(match);
  const matchLab = labelMatch(match);

  const perfilBloco = perfil ? `
    <div class="perfil" style="border-color:${perfil.cor}55">
      <div class="perfil-head">
        <div>
          <div class="perfil-tag" style="background:${perfil.cor}">${esc(perfil.tag)}</div>
          <div class="perfil-nome" style="color:${perfil.cor}">${esc(perfil.nome)}</div>
        </div>
        <div class="match" style="background:${matchCor}">
          <div class="match-v">${match}%</div>
          <div class="match-l">Match · ${esc(matchLab)}</div>
        </div>
      </div>
      <div class="perfil-resumo">${esc(perfil.plain || perfil.resumo)}</div>
      <div class="grid">
        <div class="box"><h3>Forças do perfil</h3><ul>${(perfil.forcas || []).map((x: string) => `<li><span style="color:${perfil.cor}">●</span> ${esc(x)}</li>`).join("") || "<li>—</li>"}</ul></div>
        <div class="box"><h3>Pontos de atenção</h3><ul>${(perfil.atencao || []).map((x: string) => `<li><span style="color:#ea580c">●</span> ${esc(x)}</li>`).join("") || "<li>—</li>"}</ul></div>
      </div>
    </div>` : `<div class="m">Perfil DISC ainda não calculado.</div>`;

  const posturaBloco = c.postura_score != null ? `
    <div class="postura">
      <div class="postura-head"><b>Postura no atendimento</b><span class="postura-v">${c.postura_score}%</span></div>
      <div class="bar"><div class="fill" style="width:${Math.max(2, c.postura_score)}%;background:#4b2fb3"></div></div>
    </div>` : "";

  const expTexto = c.experiencia_texto ? `<h2>Descrição enviada pelo candidato</h2><div class="resumo">${esc(c.experiencia_texto)}</div>` : "";

  const cvBloco = cv ? `
    <h2>Análise do currículo (IA)</h2>
    <div class="row"><b>Aderência à vaga:</b> <span class="tag" style="background:${nivelCor(cv.aderencia_televendas)}">${esc(nivelTxt(cv.aderencia_televendas))}</span>${cv.anos_relevantes ? `<span class="m">· ${esc(cv.anos_relevantes)}</span>` : ""}</div>
    ${cv.resumo ? `<div class="resumo" style="margin-top:8px">${esc(cv.resumo)}</div>` : ""}
    ${exp ? `<h3 class="sub">Experiências relevantes</h3>${exp}` : ""}
    <div class="grid">
      <div class="box"><h3>Pontos fortes</h3><ul>${lista(cv.pontos_fortes, "#16a34a") || "<li>—</li>"}</ul></div>
      <div class="box"><h3>Lacunas</h3><ul>${lista(cv.lacunas, "#ea580c") || "<li>—</li>"}</ul></div>
    </div>
    ${perg ? `<h3 class="sub">Sugestões para entrevista</h3>${perg}` : ""}
  ` : `<h2>Análise do currículo (IA)</h2><div class="m">Currículo ainda não analisado.</div>`;

  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Análise — ${esc(c.nome)}</title>
<style>
  *{box-sizing:border-box} body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1f1947;margin:0;padding:32px;background:#fff;font-size:13px;line-height:1.5}
  h1{font-size:22px;margin:0 0 4px;color:#4b2fb3}
  h2{font-size:14px;margin:22px 0 8px;color:#4b2fb3;border-bottom:1px solid #e5e1f1;padding-bottom:4px;page-break-after:avoid}
  h3.sub{font-size:12.5px;margin:14px 0 6px;color:#4b2fb3}
  .meta{color:#6b6485;font-size:12px;margin-bottom:14px}
  .row{display:flex;gap:8px;align-items:center;margin:6px 0;font-size:12.5px;flex-wrap:wrap}
  .tag{color:#fff;font-size:11px;font-weight:700;padding:2px 9px;border-radius:99px}
  .exp{display:flex;justify-content:space-between;align-items:center;padding:8px 11px;border:1px solid #e5e1f1;border-radius:10px;margin-bottom:6px}
  .b{font-weight:600} .m{font-size:11px;color:#9b93b0}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:8px}
  .box{border:1px solid #e5e1f1;border-radius:10px;padding:10px;page-break-inside:avoid} .box h3{font-size:12.5px;margin:0 0 6px;color:#4b2fb3}
  ul{margin:0;padding-left:18px} li{margin-bottom:3px}
  .q{font-size:12.5px;color:#6b6485;margin-bottom:5px}
  .resumo{background:#f6f3fc;border-radius:10px;padding:12px}
  .kvs{display:grid;grid-template-columns:1fr 1fr;gap:4px 18px;border:1px solid #e5e1f1;border-radius:10px;padding:10px 14px}
  .kv{display:flex;justify-content:space-between;gap:10px;font-size:12px;padding:3px 0;border-bottom:1px dashed #efecf7}
  .kv .k{color:#9b93b0} .kv .v{font-weight:600;text-align:right}
  .perfil{border:1.5px solid;border-radius:12px;padding:14px;margin-top:8px;page-break-inside:avoid}
  .perfil-head{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:8px}
  .perfil-tag{display:inline-block;color:#fff;font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:99px;margin-bottom:4px}
  .perfil-nome{font-size:18px;font-weight:800;letter-spacing:-0.3px}
  .perfil-resumo{font-size:12.5px;color:#4a4566;margin-bottom:10px}
  .match{color:#fff;border-radius:10px;padding:8px 14px;text-align:center;min-width:96px}
  .match-v{font-size:22px;font-weight:800;letter-spacing:-0.5px;line-height:1}
  .match-l{font-size:10.5px;opacity:.95;margin-top:2px}
  .dimrow{margin:8px 0 10px;page-break-inside:avoid}
  .dimhead{display:flex;justify-content:space-between;align-items:baseline;font-size:12px}
  .dimval{font-weight:700;color:#1f1947}
  .bar{height:8px;border-radius:99px;background:#efecf7;overflow:hidden;margin-top:4px}
  .fill{height:100%;border-radius:99px}
  .dimplain{margin-top:3px}
  .postura{margin-top:10px;border:1px solid #e5e1f1;border-radius:10px;padding:10px 12px}
  .postura-head{display:flex;justify-content:space-between;align-items:baseline;font-size:12.5px}
  .postura-v{font-weight:800;color:#4b2fb3}
  .foot{margin-top:24px;font-size:10.5px;color:#9b93b0;text-align:center}
  @media print{ body{padding:14px;font-size:12px} .noprint{display:none} h2{margin-top:16px} }
</style></head><body>
  <h1>Análise completa do candidato</h1>
  <div class="meta"><b style="color:#1f1947">${esc(c.nome)}</b>${vaga ? " · Vaga: " + esc(vaga.titulo) : ""}</div>

  <h2>Dados cadastrais</h2>
  ${dados}

  <h2>Perfil comportamental (DISC) e match</h2>
  ${perfilBloco}

  <h3 class="sub">Pontuação por dimensão</h3>
  ${discBars}

  ${posturaBloco}

  ${expTexto}

  ${cvBloco}

  <div class="foot">Gerado em ${new Date().toLocaleString("pt-BR")} · Estrela Recrutamento</div>
  <script>window.onload=()=>{setTimeout(()=>window.print(),300)}</script>
</body></html>`;
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) { alert("Permita pop-ups para imprimir a análise."); return; }
  w.document.open(); w.document.write(html); w.document.close();
}


/* ========== Perfil Comportamental (radar + barras horizontais) ========== */
function idealDiscFromPerfil(key: string | null | undefined): Record<"D"|"I"|"S"|"C", number> {
  const dim = key && (PERFIS as any)[key]?.dim as string | undefined;
  const base: Record<"D"|"I"|"S"|"C", number> = { D: 40, I: 40, S: 40, C: 40 };
  if (!dim) return base;
  const parts = dim.split("/") as Array<"D"|"I"|"S"|"C">;
  parts.forEach((d) => { if (base[d] !== undefined) base[d] = 88; });
  return base;
}

function PerfilComportamentalCard({
  c, p, match, disc, vaga,
}: {
  c: Candidato; p: any; match: number; disc: Record<string, number>; vaga: Vaga | null;
}) {
  const dims = ["D", "I", "S", "C"] as const;
  // Perfil-alvo: usa o perfil-alvo da vaga (maior peso); fallback no perfil do candidato
  const alvoKey = useMemo(() => {
    if (vaga?.pesos) {
      const entries = Object.entries(vaga.pesos) as Array<[string, number]>;
      entries.sort((a, b) => b[1] - a[1]);
      return entries[0]?.[0] ?? c.perfil_key ?? null;
    }
    return c.perfil_key ?? null;
  }, [vaga, c.perfil_key]);
  const ideal = useMemo(() => idealDiscFromPerfil(alvoKey), [alvoKey]);
  const alvoPerfil = alvoKey ? (PERFIS as any)[alvoKey] : null;

  const radarData = dims.map((d) => ({
    dim: d,
    Candidato: Number(disc[d] ?? 0),
    Ideal: ideal[d],
  }));

  // Design tokens do protótipo selecionado
  const DARK = "#2D2354";
  const TINT = "#F4F1FB";
  const RADAR_BG = "#FBFAFE";
  const BORDER = "#E9E4F5";
  const LAR = "#F26A2E";
  const ROX = "#4b2fb3";

  const matchCor = corMatch(match);
  const matchLab = labelMatch(match);

  return (
    <div style={{
      background: "#fff",
      border: `1px solid ${BORDER}`,
      borderRadius: 22,
      boxShadow: "0 20px 50px rgba(45,35,84,0.08)",
      overflow: "hidden",
      marginBottom: 14,
    }}>
      {/* Header (acima do split) */}
      <div style={{ padding: "20px 24px 16px", borderBottom: `1px solid ${BORDER}`, display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div className="h" style={{ fontSize: 10, color: ROX, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1.8 }}>Perfil comportamental</div>
          <h2 className="h" style={{ fontSize: 28, fontWeight: 800, color: p?.cor ?? DARK, lineHeight: 1.05, margin: "6px 0 8px", letterSpacing: -0.7 }}>
            {p?.nome ?? c.perfil_nome ?? "—"}
          </h2>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {p && <span className="h" style={{ fontSize: 11, fontWeight: 700, background: `${ROX}10`, color: ROX, padding: "5px 12px", borderRadius: 99, letterSpacing: 0.3 }}>{p.tag}</span>}
            {alvoPerfil && alvoKey !== c.perfil_key && (
              <span className="h" style={{ fontSize: 11, fontWeight: 700, background: `${LAR}14`, color: LAR, padding: "5px 12px", borderRadius: 99, letterSpacing: 0.3 }}>
                Ideal · {alvoPerfil.nome}
              </span>
            )}
          </div>
          {p?.descricao && (
            <p style={{ fontSize: 12.5, color: CINZA, marginTop: 10, lineHeight: 1.55, maxWidth: 560, fontFamily: "Inter" }}>{p.descricao}</p>
          )}
        </div>
      </div>

      {/* Split: Radar + Análise por dimensão */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1.1fr)" }}>
        {/* Coluna esquerda: Radar */}
        <div style={{ background: RADAR_BG, padding: "22px 22px 26px", borderRight: `1px solid ${BORDER}`, position: "relative", minHeight: 340 }}>
          <div>
            <h3 className="h" style={{ fontSize: 18, fontWeight: 800, color: DARK, lineHeight: 1.05, letterSpacing: -0.4, margin: 0 }}>
              Mapa<br />Comportamental
            </h3>
            <div style={{ marginTop: 8, display: "flex", gap: 12, flexWrap: "wrap" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10, fontFamily: "Inter", fontWeight: 700, color: ROX, textTransform: "uppercase", letterSpacing: 1 }}>
                <span style={{ width: 8, height: 8, borderRadius: 99, background: ROX }} /> Candidato
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 10, fontFamily: "Inter", fontWeight: 700, color: LAR, textTransform: "uppercase", letterSpacing: 1 }}>
                <span style={{ width: 8, height: 8, borderRadius: 99, background: LAR }} /> Perfil Ideal
              </span>
            </div>
          </div>

          <div style={{ position: "relative", width: "100%", height: 260, marginTop: 18 }}>
            <ResponsiveContainer>
              <RadarChart data={radarData} margin={{ top: 18, right: 28, bottom: 18, left: 28 }} outerRadius="82%">
                <defs>
                  <radialGradient id="radarCandFill2" cx="50%" cy="50%" r="70%">
                    <stop offset="0%" stopColor={ROX} stopOpacity={0.42} />
                    <stop offset="100%" stopColor={ROX} stopOpacity={0.12} />
                  </radialGradient>
                </defs>
                <PolarGrid stroke={BORDER} strokeDasharray="2 3" />
                <PolarAngleAxis
                  dataKey="dim"
                  tick={({ payload, x, y, cx, cy }: any) => {
                    const cor = (DIM_INFO as any)[payload.value]?.cor || DARK;
                    return (
                      <text
                        x={x} y={y}
                        dy={y > cy ? 14 : y < cy ? -6 : 4}
                        textAnchor={x > cx ? "start" : x < cx ? "end" : "middle"}
                        fill={cor}
                        style={{ fontFamily: "Outfit", fontSize: 18, fontWeight: 800 }}
                      >{payload.value}</text>
                    );
                  }}
                />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar name="Ideal" dataKey="Ideal" stroke={LAR} strokeWidth={2} strokeDasharray="5 4" fill="none" />
                <Radar name="Candidato" dataKey="Candidato" stroke={ROX} strokeWidth={2.5} fill="url(#radarCandFill2)" fillOpacity={1} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Coluna direita: Score + barras */}
        <div style={{ padding: "22px 24px 24px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 18 }}>
            <div>
              <div style={{ color: ROX, fontSize: 12, fontWeight: 700, fontFamily: "Inter", marginBottom: 2 }}>Match de perfil</div>
              <div className="h" style={{ fontSize: 44, fontWeight: 800, color: DARK, lineHeight: 1, letterSpacing: -1.4, fontVariantNumeric: "tabular-nums" }}>
                {match}<span style={{ fontSize: 20, fontWeight: 700, color: CINZA, marginLeft: 2 }}>%</span>
              </div>
            </div>
            <span className="h" style={{
              padding: "5px 11px",
              background: `${matchCor}12`,
              color: matchCor,
              border: `1px solid ${matchCor}33`,
              fontSize: 10,
              fontWeight: 800,
              borderRadius: 99,
              textTransform: "uppercase",
              letterSpacing: 1,
            }}>{matchLab}</span>
          </div>

          <div style={{ display: "grid", gap: 16 }}>
            {dims.map((d) => {
              const v = Number(disc[d] ?? 0);
              const id = ideal[d];
              const cor = DIM_INFO[d].cor;
              return (
                <div key={d}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 7 }}>
                    <span className="h" style={{ color: cor, fontSize: 11, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.4 }} title={DIM_INFO[d].plain}>
                      {DIM_INFO[d].nome}
                    </span>
                    <span className="h" style={{ color: DARK, fontWeight: 800, fontSize: 13, fontVariantNumeric: "tabular-nums", letterSpacing: -0.2 }}>
                      <span style={{ color: ROX }}>{v}</span>
                      <span style={{ color: "#CFC9DF", margin: "0 4px", fontWeight: 600 }}>/</span>
                      <span style={{ color: LAR }}>{id}</span>
                    </span>
                  </div>
                  <div style={{ position: "relative", height: 10, background: TINT, borderRadius: 99, overflow: "visible" }}>
                    {/* Candidato (fill) */}
                    <div style={{
                      position: "absolute", top: 0, left: 0, height: "100%",
                      width: `${Math.max(2, v)}%`,
                      background: `linear-gradient(90deg, ${ROX} 0%, ${ROX}EE 100%)`,
                      borderRadius: 99,
                      boxShadow: `0 2px 8px ${ROX}40`,
                      transition: "width .6s cubic-bezier(.2,.8,.2,1)",
                      zIndex: 1,
                    }} />
                    {/* Ideal (marcador laranja) */}
                    <div title={`Ideal ${id}%`} style={{
                      position: "absolute", top: -3, bottom: -3,
                      left: `calc(${id}% - 1.5px)`,
                      width: 3, background: LAR, borderRadius: 2,
                      boxShadow: `0 0 0 2px ${LAR}33`,
                      zIndex: 2,
                    }} />
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ fontSize: 10.5, color: CINZA, marginTop: 14, fontFamily: "Inter", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 3, height: 10, background: LAR, borderRadius: 2, display: "inline-block" }} />
            marcador laranja = valor ideal para o perfil-alvo
          </div>
        </div>
      </div>

      {/* KPI tiles (rodapé do card) */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, padding: 16, borderTop: `1px solid ${BORDER}`, background: RADAR_BG }}>
        <AnimatedStatsCard
          title="Postura no atendimento"
          primaryValue={c.postura_score ?? 0}
          primarySuffix="%"
          secondaryValue={100}
          secondaryLabel="Meta"
          icon={<Headphones size={15} />}
          accent={ROX}
        />
        <AnimatedStatsCard
          title="Aderência à vaga"
          primaryValue={match}
          primarySuffix="%"
          secondaryValue={100}
          secondaryLabel="Ideal"
          icon={<Target size={15} />}
          accent={LAR}
        />
      </div>
    </div>
  );
}

/* ========== Detalhe candidato ========== */
export function Detalhe({ c, vaga, onClose }: { c: Candidato; vaga: Vaga | null; onClose: () => void }) {
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
    <div style={{ minHeight: "100vh", background: "#FBFAFE" }}>
      <div style={{ maxWidth: 920, margin: "0 auto" }}>
        <div style={{ background: ROXO, padding: "18px 22px", display: "flex", alignItems: "center", gap: 13, position: "sticky", top: 0, zIndex: 2 }}>
          <button onClick={onClose} title="Voltar" style={{ background: "rgba(255,255,255,.18)", border: "none", borderRadius: 9, width: 34, height: 34, cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><ChevronLeft size={18} /></button>
          <div style={{ width: 46, height: 46, borderRadius: 99, background: "#fff", color: ROXO, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 16 }} className="h">
            {c.nome.split(" ").map((n) => n[0]).slice(0, 2).join("")}
          </div>
          <div style={{ flex: 1 }}>
            <div className="h" style={{ color: "#fff", fontWeight: 800, fontSize: 19 }}>{c.nome}</div>
            <div style={{ color: "#fff", opacity: 0.85, fontSize: 12.5 }}>{c.setor_atual || "—"}{vaga ? ` · ${vaga.titulo}` : ""}</div>
          </div>
          <ExcluirCandidatoBtn c={c} onDone={onClose} />
        </div>


        <div style={{ padding: 20 }}>
          <DadosCadastraisBloco c={c} />



          <JornadaBloco c={c} vaga={vaga} />


          <PerfilComportamentalCard c={c} p={p} match={match} disc={disc} vaga={vaga} />

          <QinMatchBloco candidatoId={c.id} vagaId={c.vaga_id ?? null} />

          <PassaporteBloco candidatoId={c.id} />

          <EntrevistaBloco candidatoId={c.id} etapa={c.etapa ?? "inscrito"} />

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
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <Cab icon={FileText} t="Análise de currículo (IA)" />
                <button
                  onClick={() => imprimirAnaliseCv(c, vaga, cv)}
                  style={{ background: ROXO, color: "#fff", border: "none", padding: "7px 13px", borderRadius: 9, fontSize: 12.5, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}
                  title="Imprimir / salvar em PDF"
                >
                  <Printer size={14} /> Imprimir análise
                </button>
              </div>
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


/* ====== utilitários visuais ====== */
const btnSec: React.CSSProperties = { background: "#fff", color: ROXO, border: `1.5px solid ${BORDA}`, padding: "9px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" };
const btnPri: React.CSSProperties = { background: ROXO, color: "#fff", border: "none", padding: "9px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" };
const btnEnc: React.CSSProperties = { background: "#fff", color: VERMELHO, border: `1.5px solid ${VERMELHO}55`, padding: "9px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" };
const btnDel: React.CSSProperties = { background: "#fff", color: VERMELHO, border: `1.5px solid ${VERMELHO}55`, padding: "9px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" };
const btnAdd: React.CSSProperties = { background: ROXO, color: "#fff", border: "none", padding: "10px 14px", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", fontFamily: "inherit" };
const selNivel = (n: string): React.CSSProperties => ({ padding: "6px 10px", borderRadius: 8, border: `1.5px solid ${BORDA}`, fontSize: 12, fontWeight: 700, color: n === "essencial" ? VERMELHO : n === "importante" ? LARANJA : "#7C7791", background: "#fff", cursor: "pointer", fontFamily: "inherit" });
const selMin: React.CSSProperties = { padding: "6px 10px", borderRadius: 8, border: `1.5px solid ${BORDA}`, fontSize: 12, fontWeight: 700, color: ROXO_DARK, background: "#fff", cursor: "pointer", fontFamily: "inherit" };

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
function MiniDet({ l, v }: { l: string; v: number }) {
  const n = typeof v === "number" ? v : 0;
  const cor = n >= 70 ? VERDE : n >= 50 ? LARANJA : "#C0392B";
  return (
    <div style={{ flex: 1, border: `1px solid ${BORDA}`, borderRadius: 10, padding: "11px 13px", background: "#FBFAFD" }}>
      <div style={{ fontSize: 10.5, color: CINZA, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>{l}</div>
      <div style={{ marginTop: 6, marginBottom: 8, fontFamily: "Outfit", fontSize: 26, fontWeight: 700, color: ROXO_DARK, lineHeight: 1, letterSpacing: -0.5, fontVariantNumeric: "tabular-nums" }}>
        {n}<span style={{ fontSize: 14, fontWeight: 600, color: CINZA, marginLeft: 2, letterSpacing: 0 }}>%</span>
      </div>
      <div style={{ height: 4, background: "#EEF1F6", borderRadius: 99, overflow: "hidden" }}>
        <div style={{ height: 4, width: `${n}%`, background: cor, borderRadius: 99 }} />
      </div>
    </div>
  );
}

function ExcluirCandidatoBtn({ c, onDone }: { c: Candidato; onDone: () => void }) {
  const fetchScope = useServerFn(getMyScope);
  const scopeQ = useQuery({ queryKey: ["my-scope"], queryFn: () => fetchScope() });
  const isSuper = scopeQ.data?.role === "super_admin";
  const excluirFn = useServerFn(excluirCandidato);
  const qc = useQueryClient();
  const [confirm, setConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  if (!isSuper) return null;

  const excluir = async () => {
    setErro(null); setLoading(true);
    try {
      await excluirFn({ data: { id: c.id } });
      await qc.invalidateQueries({ queryKey: ["candidatos"] });
      setConfirm(false);
      onDone();
    } catch (e: any) {
      setErro(e?.message ?? "Falha ao excluir.");
    } finally { setLoading(false); }
  };

  return (
    <>
      <button
        onClick={() => setConfirm(true)}
        title="Excluir candidato"
        style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,.15)", color: "#fff", border: "1px solid rgba(255,255,255,.25)", padding: "7px 12px", borderRadius: 9, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}
      >
        <Trash2 size={14} /> Excluir
      </button>
      {confirm && (
        <div onClick={() => !loading && setConfirm(false)} style={{ position: "fixed", inset: 0, background: "rgba(20,10,40,.5)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 14, padding: 22, maxWidth: 440, width: "100%" }}>
            <div className="h" style={{ fontSize: 18, fontWeight: 800, color: ROXO_DARK, marginBottom: 8 }}>Excluir candidato?</div>
            <div style={{ fontSize: 13.5, color: CINZA, lineHeight: 1.5, marginBottom: 14 }}>
              Esta ação remove permanentemente <b style={{ color: ROXO_DARK }}>{c.nome}</b> e seus dados relacionados. Não é possível desfazer.
            </div>
            {erro && <div style={{ marginBottom: 10, fontSize: 12.5, color: VERMELHO, fontWeight: 600 }}>{erro}</div>}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setConfirm(false)} disabled={loading} style={{ background: "#fff", color: CINZA, border: `1px solid ${BORDA}`, padding: "8px 14px", borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>Cancelar</button>
              <button onClick={excluir} disabled={loading} style={{ display: "flex", alignItems: "center", gap: 6, background: VERMELHO, color: "#fff", border: "none", padding: "8px 14px", borderRadius: 9, fontWeight: 700, fontSize: 13, cursor: "pointer", opacity: loading ? 0.7 : 1 }}>
                {loading ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Excluir definitivamente
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function DadosCadastraisBloco({ c }: { c: Candidato }) {
  const qc = useQueryClient();
  const salvarFn = useServerFn(atualizarCadastroCandidato);
  const [edit, setEdit] = useState(false);
  const [form, setForm] = useState({
    nome: c.nome ?? "",
    email: c.email ?? "",
    celular: c.celular ?? "",
    endereco: c.endereco ?? "",
    setor_atual: c.setor_atual ?? "",
    tempo_empresa: c.tempo_empresa ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    setForm({
      nome: c.nome ?? "", email: c.email ?? "", celular: c.celular ?? "",
      endereco: c.endereco ?? "", setor_atual: c.setor_atual ?? "", tempo_empresa: c.tempo_empresa ?? "",
    });
  }, [c.id]);

  const salvar = async () => {
    setErro(null); setSaving(true);
    try {
      await salvarFn({ data: { id: c.id, ...form } });
      await qc.invalidateQueries({ queryKey: ["candidato", c.id] });
      await qc.invalidateQueries({ queryKey: ["candidatos"] });
      setEdit(false);
    } catch (e: any) {
      setErro(e?.message ?? "Falha ao salvar.");
    } finally { setSaving(false); }
  };

  const cancelar = () => {
    setForm({
      nome: c.nome ?? "", email: c.email ?? "", celular: c.celular ?? "",
      endereco: c.endereco ?? "", setor_atual: c.setor_atual ?? "", tempo_empresa: c.tempo_empresa ?? "",
    });
    setErro(null); setEdit(false);
  };

  const Campo = ({ label, value, onChange, type = "text" }: { label: string; value: string; onChange: (v: string) => void; type?: string }) => (
    <div>
      <div style={{ fontSize: 11.5, color: CINZA, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3, marginBottom: 4 }}>{label}</div>
      {edit ? (
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} style={inp} />
      ) : (
        <div style={{ fontSize: 14, fontWeight: 600, color: ROXO_DARK, wordBreak: "break-word" }}>{value || "—"}</div>
      )}
    </div>
  );

  return (
    <Bloco>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <Cab icon={UserCog} t="Dados cadastrais" />
        {!edit ? (
          <button onClick={() => setEdit(true)} style={{ display: "flex", alignItems: "center", gap: 6, background: ROXO_TINT, color: ROXO, border: "none", padding: "6px 12px", borderRadius: 8, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>
            <Pencil size={13} /> Editar
          </button>
        ) : (
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={cancelar} disabled={saving} style={{ background: "#fff", color: CINZA, border: `1px solid ${BORDA}`, padding: "6px 12px", borderRadius: 8, fontWeight: 700, fontSize: 12.5, cursor: "pointer" }}>Cancelar</button>
            <button onClick={salvar} disabled={saving} style={{ display: "flex", alignItems: "center", gap: 6, background: ROXO, color: "#fff", border: "none", padding: "6px 12px", borderRadius: 8, fontWeight: 700, fontSize: 12.5, cursor: "pointer", opacity: saving ? 0.7 : 1 }}>
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Salvar
            </button>
          </div>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
        <Campo label="Nome completo" value={form.nome} onChange={(v) => setForm((f) => ({ ...f, nome: v }))} />
        <Campo label="E-mail" value={form.email} onChange={(v) => setForm((f) => ({ ...f, email: v }))} type="email" />
        <Campo label="Celular" value={form.celular} onChange={(v) => setForm((f) => ({ ...f, celular: v }))} />
        <Campo label="Endereço" value={form.endereco} onChange={(v) => setForm((f) => ({ ...f, endereco: v }))} />
        <Campo label="Setor / função atual" value={form.setor_atual} onChange={(v) => setForm((f) => ({ ...f, setor_atual: v }))} />
        <Campo label="Tempo de empresa" value={form.tempo_empresa} onChange={(v) => setForm((f) => ({ ...f, tempo_empresa: v }))} />
      </div>
      {erro && <div style={{ marginTop: 10, fontSize: 12.5, color: VERMELHO, fontWeight: 600 }}>{erro}</div>}
    </Bloco>
  );
}

function Ring({ m }: { m: number }) {
  const size = 104, stroke = 9, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const cor = corMatch(m);
  const cx = size / 2;
  return (
    <div style={{ textAlign: "center" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block" }}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke="#EEF1F6" strokeWidth={stroke} />
        <circle cx={cx} cy={cx} r={r} fill="none" stroke={cor} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (c * m) / 100} transform={`rotate(-90 ${cx} ${cx})`} style={{ transition: "stroke-dashoffset .6s ease" }} />
        <text x={cx} y={cx + 4} textAnchor="middle" fontSize="26" fontWeight="700" fill={ROXO_DARK} fontFamily="Outfit" letterSpacing="-0.5" style={{ fontVariantNumeric: "tabular-nums" }}>{m}<tspan fontSize="14" fontWeight="600" fill={CINZA} dx="1" dy="-1">%</tspan></text>
        <text x={cx} y={cx + 19} textAnchor="middle" fontSize="8" fontWeight="700" fill={CINZA} letterSpacing="1.6" style={{ textTransform: "uppercase" }}>MATCH</text>
      </svg>
      <div style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, color: cor, marginTop: 4, background: `${cor}12`, padding: "2px 8px", borderRadius: 99 }}>
        <span style={{ width: 6, height: 6, borderRadius: 99, background: cor }} />{labelMatch(m)}
      </div>
    </div>
  );
}

/* ========== Encerramento de vaga ========== */
function EncerrarVagaModal({ vagaId, onClose, onDone }: { vagaId: string; onClose: () => void; onDone: () => void }) {
  const { has } = useFeatures();
  const listCands = useServerFn(listCandidatosDaVaga);
  const listLideres = useServerFn(listLideresDaVaga);
  const encerrar = useServerFn(encerrarVagaFn);
  const [selecionou, setSelecionou] = useState<null | boolean>(null);
  const [candidatoId, setCandidatoId] = useState<string>("");
  const [dataAdm, setDataAdm] = useState<string>("");
  const [liderId, setLiderId] = useState<string>("");
  const [obs, setObs] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const candsQ = useQuery({
    queryKey: ["candidatos-vaga", vagaId],
    queryFn: () => listCands({ data: { vaga_id: vagaId } }) as Promise<any[]>,
    enabled: selecionou === true,
  });
  const lideresQ = useQuery({
    queryKey: ["lideres-vaga", vagaId],
    queryFn: () => listLideres({ data: { vaga_id: vagaId } }) as Promise<any[]>,
    enabled: selecionou === true,
  });

  function addDays(iso: string, d: number) {
    const x = new Date(iso + "T00:00:00Z");
    x.setUTCDate(x.getUTCDate() + d);
    return x.toISOString().slice(0, 10);
  }

  async function confirmar() {
    if (selecionou === null) { setErro("Escolha Sim ou Não."); return; }
    if (selecionou && (!candidatoId || !dataAdm)) { setErro("Selecione candidato e data de admissão."); return; }
    setSalvando(true); setErro("");
    try {
      await encerrar({ data: { vaga_id: vagaId, selecionou, candidato_id: candidatoId || null, data_admissao: dataAdm || null, lider_id: liderId || null, obs } });
      onDone();
    } catch (e: any) { setErro(e.message || "Falha ao encerrar."); }
    finally { setSalvando(false); }
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(20,10,40,.45)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: 16, maxWidth: 520, width: "100%", maxHeight: "90vh", overflow: "auto", padding: 22 }}>
        <div className="h" style={{ fontSize: 18, fontWeight: 800, color: ROXO_DARK, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}>
          <Ban size={18} color={VERMELHO} /> Encerrar vaga
        </div>
        <div style={{ fontSize: 13, color: CINZA, marginBottom: 16 }}>O link público fica inativo após encerrar.</div>

        <div style={{ fontSize: 13.5, fontWeight: 700, color: ROXO_DARK, marginBottom: 8 }}>Algum candidato foi selecionado?</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {[[true, "Sim"], [false, "Não"]].map(([val, lbl]: any) => {
            const on = selecionou === val;
            return (
              <button key={String(val)} onClick={() => setSelecionou(val)} style={{
                flex: 1, padding: "11px 14px", borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "inherit",
                border: `1.5px solid ${on ? ROXO : BORDA}`, background: on ? ROXO + "12" : "#fff", color: on ? ROXO : CINZA,
              }}>{lbl}</button>
            );
          })}
        </div>

        {selecionou === true && (
          <>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: ROXO_DARK, marginBottom: 6 }}>Candidato selecionado</div>
              <select value={candidatoId} onChange={(e) => setCandidatoId(e.target.value)} style={inp}>
                <option value="">Selecione…</option>
                {(candsQ.data ?? []).map((c: any) => (
                  <option key={c.id} value={c.id}>{c.nome} {typeof c.match_final === "number" ? `· ${c.match_final}% match` : ""}</option>
                ))}
              </select>
              {candsQ.isLoading && <div style={{ fontSize: 11.5, color: CINZA, marginTop: 4 }}>Carregando candidatos…</div>}
              {!candsQ.isLoading && (candsQ.data ?? []).length === 0 && <div style={{ fontSize: 11.5, color: CINZA, marginTop: 4 }}>Nenhum candidato inscrito nesta vaga.</div>}
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: ROXO_DARK, marginBottom: 6 }}>Data de admissão</div>
              <input type="date" value={dataAdm} onChange={(e) => setDataAdm(e.target.value)} style={inp} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: ROXO_DARK, marginBottom: 6 }}>Líder imediato <span style={{ fontWeight: 500, color: "#9b93b0" }}>(líderes do setor da vaga)</span></div>
              <select value={liderId} onChange={(e) => setLiderId(e.target.value)} style={inp}>
                <option value="">{(lideresQ.data ?? []).length ? "Selecione…" : "Nenhum líder cadastrado para o setor — definir depois"}</option>
                {Array.from(new Set((lideresQ.data ?? []).map((l: any) => l.nivel))).map((nv: any) => {
                  const grupo = (lideresQ.data ?? []).filter((l: any) => l.nivel === nv);
                  if (!grupo.length) return null;
                  return <optgroup key={nv} label={nv}>{grupo.map((l: any) => <option key={l.id} value={l.id}>{l.nome}</option>)}</optgroup>;
                })}
              </select>
            </div>
            {dataAdm && has("avaliacao_experiencia") && (
              <div style={{ background: ROXO_TINT, borderRadius: 10, padding: 12, fontSize: 12.5, color: ROXO_DARK, marginBottom: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                  <CalendarClock size={13} color={ROXO} /> Avaliações de experiência agendadas:
                </div>
                {[30, 60, 90].map((m) => (
                  <div key={m} style={{ display: "flex", justifyContent: "space-between", padding: "3px 0" }}>
                    <span>{m} dias</span><strong>{fmtData(addDays(dataAdm, m))}</strong>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: ROXO_DARK, marginBottom: 6 }}>Observação (opcional)</div>
          <textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} style={{ ...inp, resize: "vertical" }} />
        </div>

        {erro && <div style={{ fontSize: 12.5, color: VERMELHO, marginBottom: 10 }}>{erro}</div>}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={btnSec}>Cancelar</button>
          <button onClick={confirmar} disabled={salvando || selecionou === null} style={{ ...btnPri, opacity: salvando || selecionou === null ? 0.6 : 1 }}>
            {salvando ? <Loader2 size={14} className="spin" /> : <Check size={14} />} Confirmar encerramento
          </button>
        </div>
      </div>
    </div>
  );
}

function ContratacaoCard({ vagaId }: { vagaId: string }) {
  const fetchContr = useServerFn(getContratacaoByVaga);
  const reenviar = useServerFn(reenviarAvaliacao);
  const marcarResp = useServerFn(marcarAvaliacaoRespondida);
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["contratacao", vagaId],
    queryFn: () => fetchContr({ data: { vaga_id: vagaId } }) as Promise<any>,
  });
  if (q.isLoading) return null;
  const c = q.data;
  if (!c) {
    return (
      <div style={{ marginTop: 10, background: "#FAFAFA", border: `1px dashed ${BORDA}`, borderRadius: 10, padding: "10px 12px", fontSize: 12, color: CINZA }}>
        Encerrada — nenhum candidato selecionado.
      </div>
    );
  }
  const statusCor = (s: string) => s === "respondida" ? VERDE : s === "enviada" ? ROXO : s === "cancelada" ? CINZA : LARANJA;
  return (
    <div style={{ marginTop: 10, background: VERDE + "08", border: `1px solid ${VERDE}55`, borderRadius: 10, padding: "12px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: ROXO_DARK, fontWeight: 700, marginBottom: 8 }}>
        <Check size={14} color={VERDE} /> Contratado: {c.nome} · admissão {fmtData(c.data_admissao)}
      </div>
      <div style={{ display: "grid", gap: 6 }}>
        {(c.avaliacoes ?? []).map((a: any) => (
          <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: CINZA, flexWrap: "wrap" }}>
            <strong style={{ color: ROXO_DARK, minWidth: 56 }}>{a.marco} dias</strong>
            <span>{fmtData(a.data_prevista)}</span>
            <span style={{ fontWeight: 700, color: statusCor(a.status), background: statusCor(a.status) + "18", padding: "2px 8px", borderRadius: 99, fontSize: 10.5, textTransform: "uppercase" }}>{a.status}</span>
            <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
              {a.status !== "respondida" && (
                <button onClick={async () => { await reenviar({ data: { avaliacao_id: a.id } }); qc.invalidateQueries({ queryKey: ["contratacao", vagaId] }); }} style={{ background: "#fff", color: ROXO, border: `1px solid ${BORDA}`, padding: "4px 9px", borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Reenviar</button>
              )}
              {a.status !== "respondida" && (
                <button onClick={async () => { await marcarResp({ data: { avaliacao_id: a.id } }); qc.invalidateQueries({ queryKey: ["contratacao", vagaId] }); }} style={{ background: "#fff", color: VERDE, border: `1px solid ${VERDE}55`, padding: "4px 9px", borderRadius: 7, fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>Marcar respondida</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ========== Jornada do candidato ========== */
function JornadaBloco({ c, vaga }: { c: Candidato; vaga: Vaga | null }) {
  const qc = useQueryClient();
  const selecionar = useServerFn(selecionarParaEntrevista);
  const remover = useServerFn(removerEntrevista);
  const fetchContr = useServerFn(getContratacaoByVaga);
  const etapa = (c.etapa ?? "inscrito") as "inscrito" | "entrevista" | "contratado" | "nao_contratado";
  const vagaFechada = !!vaga && (vaga.status === "Fechada" || !!(vaga as any).encerrada_em);
  const final = etapa === "contratado" || etapa === "nao_contratado";

  const [editando, setEditando] = useState(etapa === "inscrito");
  const [data, setData] = useState<string>(c.entrevista_data ? new Date(c.entrevista_data).toISOString().slice(0, 16) : "");
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);

  const contrQ = useQuery({
    queryKey: ["contratacao", c.vaga_id],
    queryFn: () => fetchContr({ data: { vaga_id: c.vaga_id! } }) as Promise<any>,
    enabled: !!c.vaga_id && etapa === "contratado",
  });

  async function salvar() {
    if (!data) { setErro("Escolha a data."); return; }
    setSalvando(true); setErro("");
    try {
      await selecionar({ data: { candidato_id: c.id, data: new Date(data).toISOString() } });
      qc.invalidateQueries({ queryKey: ["candidato", c.id] });
      qc.invalidateQueries({ queryKey: ["candidatos"] });
      setEditando(false);
    } catch (e: any) { setErro(e.message || "Falha."); }
    finally { setSalvando(false); }
  }
  async function tirar() {
    if (!confirm("Remover da etapa de entrevista?")) return;
    try {
      await remover({ data: { candidato_id: c.id } });
      qc.invalidateQueries({ queryKey: ["candidato", c.id] });
      qc.invalidateQueries({ queryKey: ["candidatos"] });
      setEditando(true); setData("");
    } catch (e: any) { alert(e.message || "Falha."); }
  }

  const fmtDT = (iso: string | null | undefined) => iso ? new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "";
  const contr = contrQ.data;

  return (
    <Bloco>
      <Cab icon={Calendar} t="Jornada do candidato" />
      <Etapa done titulo="Inscrição" cor={VERDE} ultimo={false}>
        <div style={{ fontSize: 12.5, color: CINZA }}>Inscrito em {new Date(c.created_at).toLocaleString("pt-BR")}</div>
      </Etapa>

      <Etapa done={etapa === "entrevista" || final} ativo={etapa === "inscrito"} ultimo={false} titulo="Entrevista" cor={etapa === "entrevista" || final ? VERDE : LARANJA}>
        {etapa === "inscrito" && !vagaFechada && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <input type="datetime-local" value={data} onChange={(e) => setData(e.target.value)} style={{ ...inp, flex: "1 1 220px" }} />
            <button onClick={salvar} disabled={!data || salvando} style={{ ...btnPri, opacity: data && !salvando ? 1 : 0.5 }}>Selecionar para entrevista</button>
          </div>
        )}
        {etapa === "inscrito" && vagaFechada && <div style={{ fontSize: 12.5, color: CINZA }}>Vaga encerrada — não é possível agendar entrevista.</div>}
        {etapa === "entrevista" && !editando && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, color: ROXO_DARK }}>Marcada para <strong>{fmtDT(c.entrevista_data)}</strong></span>
            {!vagaFechada && <button onClick={() => setEditando(true)} style={{ background: "none", border: "none", color: ROXO, fontSize: 12, fontWeight: 700, cursor: "pointer", padding: 0, fontFamily: "inherit" }}>remarcar</button>}
            {!vagaFechada && <button onClick={tirar} style={{ background: "none", border: "none", color: VERMELHO, fontSize: 12, fontWeight: 700, cursor: "pointer", padding: 0, fontFamily: "inherit" }}>remover</button>}
          </div>
        )}
        {etapa === "entrevista" && editando && !vagaFechada && (
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <input type="datetime-local" value={data} onChange={(e) => setData(e.target.value)} style={{ ...inp, flex: "1 1 220px" }} />
            <button onClick={salvar} disabled={!data || salvando} style={{ ...btnPri, opacity: data && !salvando ? 1 : 0.5 }}>Confirmar</button>
            <button onClick={() => setEditando(false)} style={btnSec}>Cancelar</button>
          </div>
        )}
        {final && c.entrevista_data && <div style={{ fontSize: 12.5, color: CINZA }}>Entrevista: {fmtDT(c.entrevista_data)}</div>}
        {erro && <div style={{ fontSize: 12, color: VERMELHO, marginTop: 6 }}>{erro}</div>}
      </Etapa>

      <Etapa done={final} ativo={etapa === "entrevista"} ultimo titulo="Resultado" cor={etapa === "contratado" ? VERDE : etapa === "nao_contratado" ? "#9b93b0" : LARANJA}>
        {!final && <div style={{ fontSize: 12.5, color: CINZA }}>Definido quando a vaga for encerrada.</div>}
        {etapa === "contratado" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 700, fontSize: 13.5, color: VERDE, marginBottom: 8 }}>
              <Award size={16} /> Contratado{contr?.data_admissao ? ` · admissão ${fmtData(contr.data_admissao)}` : ""}
            </div>
            <div style={{ fontSize: 12.5, color: ROXO_DARK, marginBottom: 10 }}>
              Líder imediato: <strong>{contr?.lider ? `${contr.lider.nome} (${contr.lider.nivel})` : "definir depois"}</strong>
            </div>
            {contr?.avaliacoes?.length > 0 && (
              <div style={{ background: LARANJA_TINT, borderRadius: 12, padding: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: ROXO_DARK, display: "flex", alignItems: "center", gap: 6, marginBottom: 9 }}>
                  <CalendarClock size={14} color={LARANJA} /> Fases de experiência
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {contr.avaliacoes.map((a: any) => (
                    <div key={a.id} style={{ textAlign: "center", background: "#fff", border: `1px solid ${BORDA}`, borderRadius: 10, padding: "8px 13px" }}>
                      <div className="h" style={{ fontWeight: 800, fontSize: 14, color: ROXO }}>{a.marco} dias</div>
                      <div style={{ fontSize: 11, color: CINZA, fontWeight: 600 }}>{fmtData(a.data_prevista)}</div>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: a.status === "respondida" ? VERDE : a.status === "enviada" ? ROXO : LARANJA, marginTop: 2, textTransform: "uppercase" }}>{a.status}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        {etapa === "nao_contratado" && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: 13.5, color: "#9b93b0" }}>
            <Ban size={16} /> Não contratado — {c.nao_contratado_motivo === "vaga_preenchida" ? "vaga preenchida por outro candidato" : "vaga encerrada sem contratação"}
          </div>
        )}
      </Etapa>
    </Bloco>
  );
}

function Etapa({ done, ativo, ultimo, titulo, cor, children }: { done?: boolean; ativo?: boolean; ultimo?: boolean; titulo: string; cor: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 13 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ width: 28, height: 28, borderRadius: 99, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: done ? cor : ativo ? cor + "22" : "#EFECF7", color: done ? "#fff" : ativo ? cor : "#9b93b0", border: `2px solid ${done || ativo ? cor : "#E0DBEE"}` }}>
          {done ? <Check size={14} /> : <span style={{ fontSize: 10, fontWeight: 800 }}>•</span>}
        </div>
        {!ultimo && <div style={{ width: 2, flex: 1, minHeight: 20, background: done ? cor + "66" : "#E0DBEE", margin: "4px 0" }} />}
      </div>
      <div style={{ flex: 1, paddingBottom: ultimo ? 0 : 16 }}>
        <div className="h" style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 6, color: ROXO_DARK }}>{titulo}</div>
        {children}
      </div>
    </div>
  );
}
