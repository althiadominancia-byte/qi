import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, Plus, X, Save, Edit3, Trash2, Users, Building2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getMyScope } from "@/lib/scope.functions";
import { upsertLider, excluirLider } from "@/lib/lideres.functions";
import { ROXO, ROXO_DARK, BORDA, CINZA, LARANJA, VERDE, VERMELHO } from "@/lib/recrutamento/data";
import { MarcaEstrela } from "@/components/MarcaEstrela";

type Search = { empresa?: string };
export const Route = createFileRoute("/_authenticated/lideres")({
  head: () => ({ meta: [{ title: "Líderes · Gestores, Coordenadores e Supervisores" }] }),
  validateSearch: (s: Record<string, unknown>): Search => ({ empresa: typeof s.empresa === "string" ? s.empresa : undefined }),
  component: LideresPage,
});

type Area = { departamento_id: string; setor_id: string | null };
type Lider = {
  id?: string;
  nome: string;
  email: string;
  telefone: string;
  nivel: string;
  ativo: boolean;
  areas: Area[];
};

const inp: React.CSSProperties = { padding: "8px 10px", border: `1.5px solid ${BORDA}`, borderRadius: 8, fontSize: 13, outline: "none", background: "#fff", color: ROXO_DARK, fontFamily: "inherit", width: "100%" };
const btn = (bg = ROXO, fg = "#fff"): React.CSSProperties => ({ background: bg, color: fg, border: "none", padding: "8px 12px", borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "inherit" });

function emptyLider(nivel: string): Lider {
  return { nome: "", email: "", telefone: "", nivel, ativo: true, areas: [] };
}

function LideresPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const fetchScope = useServerFn(getMyScope);
  const scopeQ = useQuery({ queryKey: ["my-scope"], queryFn: () => fetchScope() });
  const scope = scopeQ.data;
  const isSuper = scope?.role === "super_admin";
  const empresaId = isSuper ? (search.empresa ?? null) : (scope?.empresa_id ?? null);

  const callUpsert = useServerFn(upsertLider);
  const callDel = useServerFn(excluirLider);

  const catQ = useQuery({
    queryKey: ["lid-catalogo", empresaId],
    queryFn: async () => {
      const { data: deps } = await supabase.from("departamentos").select("id,nome,ativo,ordem").eq("empresa_id", empresaId!).eq("ativo", true).order("ordem").order("nome");
      const { data: sets } = await supabase.from("setores").select("id,nome,ativo,ordem,departamento_id").eq("empresa_id", empresaId!).eq("ativo", true).order("ordem").order("nome");
      return { deps: deps ?? [], sets: sets ?? [] };
    },
    enabled: !!empresaId,
  });

  const lideresQ = useQuery({
    queryKey: ["lideres", empresaId],
    queryFn: async () => {
      const { data: lideres } = await supabase.from("lideres").select("id,nome,email,telefone,nivel,ativo").eq("empresa_id", empresaId!).order("nome");
      const ids = (lideres ?? []).map((l: any) => l.id);
      let areas: any[] = [];
      if (ids.length) {
        const { data } = await supabase.from("lider_areas").select("lider_id,departamento_id,setor_id").in("lider_id", ids);
        areas = data ?? [];
      }
      return (lideres ?? []).map((l: any) => ({
        ...l,
        areas: areas.filter((a) => a.lider_id === l.id).map((a) => ({ departamento_id: a.departamento_id, setor_id: a.setor_id })),
      })) as (Lider & { id: string })[];
    },
    enabled: !!empresaId,
  });

  const [edit, setEdit] = useState<Lider | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");

  const empresaQ = useQuery({
    queryKey: ["empresa", empresaId],
    queryFn: async () => {
      const { data } = await supabase.from("empresas").select("id,nome").eq("id", empresaId!).maybeSingle();
      return data;
    },
    enabled: !!empresaId,
  });

  const deps = catQ.data?.deps ?? [];
  const sets = catQ.data?.sets ?? [];
  const setoresPorDep = useMemo(() => {
    const m: Record<string, any[]> = {};
    for (const s of sets) (m[s.departamento_id] ||= []).push(s);
    return m;
  }, [sets]);
  const nomeDep = (id: string) => deps.find((d: any) => d.id === id)?.nome ?? "—";
  const nomeSet = (id: string | null) => (id ? sets.find((s: any) => s.id === id)?.nome ?? "—" : "Todo o departamento");

  function novo() { setErro(""); setEdit(emptyLider()); }
  function editar(l: Lider & { id: string }) { setErro(""); setEdit(JSON.parse(JSON.stringify(l))); }
  function addArea() {
    if (!edit) return;
    setEdit({ ...edit, areas: [...edit.areas, { departamento_id: deps[0]?.id ?? "", setor_id: null }] });
  }
  function removeArea(i: number) {
    if (!edit) return;
    setEdit({ ...edit, areas: edit.areas.filter((_, k) => k !== i) });
  }
  function setArea(i: number, patch: Partial<Area>) {
    if (!edit) return;
    setEdit({ ...edit, areas: edit.areas.map((a, k) => k === i ? { ...a, ...patch } : a) });
  }

  async function salvar() {
    if (!edit || !empresaId) return;
    if (!edit.nome.trim()) { setErro("Informe o nome."); return; }
    const areasOK = edit.areas.filter((a) => a.departamento_id);
    setSalvando(true); setErro("");
    try {
      await callUpsert({
        data: {
          empresa_id: empresaId,
          id: edit.id || undefined,
          nome: edit.nome.trim(),
          email: edit.email?.trim() || null,
          telefone: edit.telefone?.trim() || null,
          nivel: edit.nivel,
          ativo: edit.ativo,
          areas: areasOK.map((a) => ({ departamento_id: a.departamento_id, setor_id: a.setor_id || null })),
        },
      });
      setEdit(null);
      lideresQ.refetch();
    } catch (e: any) { setErro(e.message || "Falha ao salvar"); }
    finally { setSalvando(false); }
  }

  async function excluir(id: string, nome: string) {
    if (!confirm(`Excluir o líder "${nome}"? Vínculos serão removidos. Contratações já registradas mantêm o histórico.`)) return;
    try { await callDel({ data: { id } }); lideresQ.refetch(); }
    catch (e: any) { alert(e.message || "Falha"); }
  }

  if (!scopeQ.isSuccess) return <div style={{ padding: 24, color: CINZA }}>Carregando…</div>;
  if (!empresaId) return (
    <div style={{ padding: 24 }}>
      <p style={{ color: CINZA }}>Selecione uma empresa em Administração antes de gerenciar líderes.</p>
      <button style={btn()} onClick={() => navigate({ to: "/super" })}>Ir para Administração</button>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#FAFAFC" }}>
      <header style={{ background: ROXO, color: "#fff", padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
        <MarcaEstrela size={28} branca />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>Líderes · Gestores, Coordenadores e Supervisores</div>
          <div style={{ fontSize: 12, opacity: 0.85, display: "flex", alignItems: "center", gap: 6 }}>
            <Building2 size={13} /> {empresaQ.data?.nome ?? "—"}
          </div>
        </div>
        <button style={btn("rgba(255,255,255,.15)")} onClick={() => navigate({ to: "/admin", search: { empresa: empresaId } })}>
          <ChevronLeft size={14} /> Voltar
        </button>
      </header>

      <div style={{ maxWidth: 980, margin: "0 auto", padding: 18, display: "grid", gap: 14 }}>
        <div style={{ background: "#fff", border: `1px solid ${BORDA}`, borderRadius: 12, padding: 14, display: "flex", alignItems: "center", gap: 10 }}>
          <Users size={18} color={ROXO} />
          <div style={{ flex: 1, fontSize: 13, color: ROXO_DARK }}>
            Cadastre os líderes e vincule-os a um <strong>departamento</strong> (e opcionalmente um <strong>setor</strong>). Eles ficam disponíveis no encerramento de vagas como "Líder imediato" do candidato contratado.
          </div>
          <button style={btn(LARANJA)} onClick={novo}><Plus size={14} /> Novo líder</button>
        </div>

        <div style={{ background: "#fff", border: `1px solid ${BORDA}`, borderRadius: 12, overflow: "hidden" }}>
          {lideresQ.isLoading && <div style={{ padding: 18, color: CINZA }}>Carregando…</div>}
          {lideresQ.isSuccess && (lideresQ.data?.length ?? 0) === 0 && (
            <div style={{ padding: 24, textAlign: "center", color: CINZA, fontSize: 13 }}>Nenhum líder cadastrado.</div>
          )}
          {(lideresQ.data ?? []).map((l) => (
            <div key={l.id} style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, padding: 12, borderBottom: `1px solid ${BORDA}`, background: l.ativo ? "#fff" : "#FAF7FD" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <strong style={{ color: ROXO_DARK, fontSize: 14 }}>{l.nome}</strong>
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 999, background: ROXO, color: "#fff", fontWeight: 700 }}>{NIVEL_LABEL[l.nivel]}</span>
                  {!l.ativo && <span style={{ fontSize: 11, color: VERMELHO, fontWeight: 700 }}>Inativo</span>}
                </div>
                <div style={{ fontSize: 12, color: CINZA, marginTop: 2 }}>
                  {l.email || "—"} {l.telefone ? `· ${l.telefone}` : ""}
                </div>
                <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {l.areas.length === 0 && <span style={{ fontSize: 11, color: CINZA, fontStyle: "italic" }}>Sem áreas vinculadas</span>}
                  {l.areas.map((a, i) => (
                    <span key={i} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, background: "#F4EEFE", color: ROXO_DARK, border: `1px solid ${BORDA}` }}>
                      {nomeDep(a.departamento_id)} · {nomeSet(a.setor_id)}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button style={btn("#fff", ROXO)} onClick={() => editar(l)}><Edit3 size={12} /> Editar</button>
                <button style={btn("#fff", VERMELHO)} onClick={() => excluir(l.id!, l.nome)}><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {edit && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 12, width: "100%", maxWidth: 640, maxHeight: "90vh", overflow: "auto" }}>
            <div style={{ padding: "14px 16px", borderBottom: `1px solid ${BORDA}`, display: "flex", alignItems: "center", gap: 10 }}>
              <strong style={{ flex: 1, color: ROXO_DARK }}>{edit.id ? "Editar líder" : "Novo líder"}</strong>
              <button style={{ background: "none", border: "none", cursor: "pointer", color: CINZA }} onClick={() => setEdit(null)}><X size={18} /></button>
            </div>

            <div style={{ padding: 16, display: "grid", gap: 12 }}>
              {erro && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#B91C1C", padding: 10, borderRadius: 10, fontSize: 13 }}>{erro}</div>}

              <Label>Nome *</Label>
              <input style={inp} value={edit.nome} onChange={(e) => setEdit({ ...edit, nome: e.target.value })} />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <Label>E-mail</Label>
                  <input style={inp} type="email" value={edit.email} onChange={(e) => setEdit({ ...edit, email: e.target.value })} />
                </div>
                <div>
                  <Label>Telefone</Label>
                  <input style={inp} value={edit.telefone} onChange={(e) => setEdit({ ...edit, telefone: e.target.value })} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, alignItems: "end" }}>
                <div>
                  <Label>Nível *</Label>
                  <select style={inp} value={edit.nivel} onChange={(e) => setEdit({ ...edit, nivel: e.target.value as Nivel })}>
                    <option value="gestor">Gestor</option>
                    <option value="coordenador">Coordenador</option>
                    <option value="supervisor">Supervisor</option>
                  </select>
                </div>
                <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: ROXO_DARK, paddingBottom: 8 }}>
                  <input type="checkbox" checked={edit.ativo} onChange={(e) => setEdit({ ...edit, ativo: e.target.checked })} /> Ativo
                </label>
              </div>

              <div style={{ borderTop: `1px solid ${BORDA}`, paddingTop: 10 }}>
                <div style={{ display: "flex", alignItems: "center", marginBottom: 8 }}>
                  <Label>Áreas de atuação</Label>
                  <button style={{ ...btn("#fff", ROXO), marginLeft: "auto" }} onClick={addArea} disabled={deps.length === 0}>
                    <Plus size={12} /> Adicionar área
                  </button>
                </div>
                {deps.length === 0 && <div style={{ fontSize: 12, color: CINZA }}>Cadastre departamentos no Catálogo antes de vincular áreas.</div>}
                {edit.areas.length === 0 && deps.length > 0 && (
                  <div style={{ fontSize: 12, color: CINZA, fontStyle: "italic" }}>Nenhuma área vinculada. O líder só aparecerá em vagas das áreas adicionadas aqui.</div>
                )}
                <div style={{ display: "grid", gap: 6 }}>
                  {edit.areas.map((a, i) => {
                    const setoresDep = setoresPorDep[a.departamento_id] ?? [];
                    return (
                      <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 6 }}>
                        <select style={inp} value={a.departamento_id} onChange={(e) => setArea(i, { departamento_id: e.target.value, setor_id: null })}>
                          {deps.map((d: any) => <option key={d.id} value={d.id}>{d.nome}</option>)}
                        </select>
                        <select style={inp} value={a.setor_id ?? ""} onChange={(e) => setArea(i, { setor_id: e.target.value || null })}>
                          <option value="">Todo o departamento</option>
                          {setoresDep.map((s: any) => <option key={s.id} value={s.id}>{s.nome}</option>)}
                        </select>
                        <button style={btn("#fff", VERMELHO)} onClick={() => removeArea(i)}><X size={12} /></button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div style={{ padding: 14, borderTop: `1px solid ${BORDA}`, display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button style={btn("#fff", CINZA)} onClick={() => setEdit(null)} disabled={salvando}>Cancelar</button>
              <button style={btn(LARANJA)} onClick={salvar} disabled={salvando}>
                {salvando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 12, fontWeight: 700, color: ROXO_DARK, marginBottom: 4 }}>{children}</div>;
}
