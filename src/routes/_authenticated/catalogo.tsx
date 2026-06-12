import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, ChevronDown, ChevronRight, Plus, X, Save, Power, ArrowUp, ArrowDown, RotateCcw, FolderTree, Building2, CheckCircle2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getMyScope } from "@/lib/scope.functions";
import { saveCatalogo, seedCatalogoPadrao } from "@/lib/catalogo.functions";
import { ROXO, ROXO_DARK, ROXO_TINT, LARANJA, CINZA, BORDA, VERDE, VERMELHO } from "@/lib/recrutamento/data";
import { MarcaEstrela } from "@/components/MarcaEstrela";

type Search = { empresa?: string };
export const Route = createFileRoute("/_authenticated/catalogo")({
  head: () => ({ meta: [{ title: "Catálogo · Departamentos & Setores" }] }),
  validateSearch: (s: Record<string, unknown>): Search => ({ empresa: typeof s.empresa === "string" ? s.empresa : undefined }),
  component: CatalogoPage,
});

type SetorL = { id?: string; nome: string; ativo: boolean; ordem: number; _new?: boolean };
type DepL = { id?: string; nome: string; ativo: boolean; ordem: number; setores: SetorL[]; _new?: boolean };

const uid = () => "tmp-" + Math.random().toString(36).slice(2, 10);
const move = <T,>(arr: T[], i: number, dir: number): T[] => {
  const j = i + dir; if (j < 0 || j >= arr.length) return arr;
  const a = [...arr]; [a[i], a[j]] = [a[j], a[i]]; return a;
};

const inp: React.CSSProperties = { padding: "8px 10px", border: `1.5px solid ${BORDA}`, borderRadius: 8, fontSize: 13, outline: "none", background: "#fff", color: ROXO_DARK, fontFamily: "inherit" };
const btn = (bg = ROXO, fg = "#fff"): React.CSSProperties => ({ background: bg, color: fg, border: "none", padding: "8px 12px", borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "inherit" });

function CatalogoPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const fetchScope = useServerFn(getMyScope);
  const scopeQ = useQuery({ queryKey: ["my-scope"], queryFn: () => fetchScope() });
  const scope = scopeQ.data;
  const isSuper = scope?.role === "super_admin";
  const empresaId = isSuper ? (search.empresa ?? null) : (scope?.empresa_id ?? null);

  const empresaQ = useQuery({
    queryKey: ["empresa", empresaId],
    queryFn: async () => {
      const { data } = await supabase.from("empresas").select("id,nome").eq("id", empresaId!).maybeSingle();
      return data;
    }, enabled: !!empresaId,
  });

  const catQ = useQuery({
    queryKey: ["catalogo", empresaId],
    queryFn: async () => {
      const { data: deps } = await supabase.from("departamentos").select("id,nome,ativo,ordem").eq("empresa_id", empresaId!).order("ordem").order("nome");
      const { data: sets } = await supabase.from("setores").select("id,nome,ativo,ordem,departamento_id").eq("empresa_id", empresaId!).order("ordem").order("nome");
      const map: DepL[] = (deps ?? []).map((d: any) => ({
        id: d.id, nome: d.nome, ativo: d.ativo, ordem: d.ordem,
        setores: (sets ?? []).filter((s: any) => s.departamento_id === d.id).map((s: any) => ({ id: s.id, nome: s.nome, ativo: s.ativo, ordem: s.ordem })),
      }));
      return map;
    }, enabled: !!empresaId,
  });

  const [deps, setDeps] = useState<DepL[]>([]);
  const [abertos, setAbertos] = useState<Record<string, boolean>>({});
  const [novoDep, setNovoDep] = useState("");
  const [dirty, setDirty] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [salvoEm, setSalvoEm] = useState<Date | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (catQ.data) { setDeps(catQ.data); setDirty(false); setSalvoEm(null); }
  }, [catQ.data]);

  const mut = (fn: (p: DepL[]) => DepL[]) => { setDeps(fn); setDirty(true); setSalvoEm(null); };
  const toggleAberto = (k: string) => setAbertos((p) => ({ ...p, [k]: !p[k] }));

  const addDep = () => {
    if (!novoDep.trim()) return;
    mut((p) => [...p, { nome: novoDep.trim(), ativo: true, ordem: p.length, setores: [], _new: true }]);
    setNovoDep("");
  };
  const renameDep = (i: number, nome: string) => mut((p) => p.map((d, k) => k === i ? { ...d, nome } : d));
  const toggleDep = (i: number) => mut((p) => p.map((d, k) => k === i ? { ...d, ativo: !d.ativo } : d));
  const removeDep = (i: number) => { if (confirm("Remover este departamento? Setores serão removidos junto. Se houver vagas vinculadas, será apenas inativado.")) mut((p) => p.filter((_, k) => k !== i)); };
  const moveDep = (i: number, dir: number) => mut((p) => move(p, i, dir));

  const addSetor = (di: number, nome: string) => {
    if (!nome.trim()) return;
    mut((p) => p.map((d, k) => k === di ? { ...d, setores: [...d.setores, { nome: nome.trim(), ativo: true, ordem: d.setores.length, _new: true }] } : d));
  };
  const renameSetor = (di: number, si: number, nome: string) => mut((p) => p.map((d, k) => k === di ? { ...d, setores: d.setores.map((s, j) => j === si ? { ...s, nome } : s) } : d));
  const toggleSetor = (di: number, si: number) => mut((p) => p.map((d, k) => k === di ? { ...d, setores: d.setores.map((s, j) => j === si ? { ...s, ativo: !s.ativo } : s) } : d));
  const removeSetor = (di: number, si: number) => { if (confirm("Remover este setor? Se houver vagas vinculadas, será apenas inativado.")) mut((p) => p.map((d, k) => k === di ? { ...d, setores: d.setores.filter((_, j) => j !== si) } : d)); };
  const moveSetor = (di: number, si: number, dir: number) => mut((p) => p.map((d, k) => k === di ? { ...d, setores: move(d.setores, si, dir) } : d));

  const callSave = useServerFn(saveCatalogo);
  const callSeed = useServerFn(seedCatalogoPadrao);

  async function salvar() {
    if (!empresaId) return;
    setSalvando(true); setErro("");
    try {
      const payload = {
        empresa_id: empresaId,
        departamentos: deps.map((d, i) => ({
          id: d.id, nome: d.nome, ativo: d.ativo, ordem: i,
          setores: d.setores.map((s, j) => ({ id: s.id, nome: s.nome, ativo: s.ativo, ordem: j })),
        })),
      };
      await callSave({ data: payload });
      setDirty(false); setSalvoEm(new Date());
      catQ.refetch();
    } catch (e: any) { setErro(e.message || "Falha ao salvar"); }
    finally { setSalvando(false); }
  }

  async function restaurarPadrao() {
    if (!empresaId) return;
    if (!confirm("Adicionar o catálogo padrão (Comercial, Logística, Administrativo) à empresa? Itens existentes não são alterados.")) return;
    setSalvando(true); setErro("");
    try { await callSeed({ data: { empresa_id: empresaId } }); catQ.refetch(); }
    catch (e: any) { setErro(e.message || "Falha"); }
    finally { setSalvando(false); }
  }

  if (!scopeQ.isSuccess) return <div style={{ padding: 24, color: CINZA }}>Carregando…</div>;
  if (!empresaId) return (
    <div style={{ padding: 24 }}>
      <p style={{ color: CINZA }}>Selecione uma empresa em Administração antes de gerenciar o catálogo.</p>
      <button style={btn()} onClick={() => navigate({ to: "/super" })}>Ir para Administração</button>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#FAFAFC" }}>
      <header style={{ background: ROXO, color: "#fff", padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>Catálogo · Departamentos &amp; Setores</div>
          <div style={{ fontSize: 12, opacity: 0.85, display: "flex", alignItems: "center", gap: 6 }}>
            <Building2 size={13} /> {empresaQ.data?.nome ?? "—"}
          </div>
        </div>
        <button style={btn("rgba(255,255,255,.15)")} onClick={() => navigate({ to: "/lideres", search: { empresa: empresaId } })}>
          Líderes
        </button>
        <button style={btn("rgba(255,255,255,.15)")} onClick={() => navigate({ to: "/admin", search: { empresa: empresaId } })}>
          <ChevronLeft size={14} /> Voltar
        </button>
      </header>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: 18, display: "grid", gap: 14 }}>
        {erro && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#B91C1C", padding: 10, borderRadius: 10, fontSize: 13 }}>{erro}</div>}
        <div style={{ background: "#fff", border: `1px solid ${BORDA}`, borderRadius: 12, padding: 14, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <FolderTree size={18} color={ROXO} />
          <div style={{ flex: 1, fontSize: 13, color: ROXO_DARK }}>
            Estes Departamentos e Setores aparecerão como opções ao criar uma vaga.
            {dirty && <strong style={{ marginLeft: 6, color: LARANJA }}>· alterações não salvas</strong>}
            {salvoEm && !dirty && <span style={{ marginLeft: 6, color: VERDE, display: "inline-flex", alignItems: "center", gap: 4 }}><CheckCircle2 size={13} /> salvo</span>}
          </div>
          <button style={btn("#fff", ROXO)} onClick={restaurarPadrao} disabled={salvando}>
            <RotateCcw size={14} /> Restaurar padrão
          </button>
          <button style={btn(LARANJA)} onClick={salvar} disabled={!dirty || salvando}>
            {salvando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar
          </button>
        </div>

        <div style={{ background: "#fff", border: `1px solid ${BORDA}`, borderRadius: 12, padding: 14 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input style={{ ...inp, flex: 1 }} placeholder="Novo departamento…" value={novoDep} onChange={(e) => setNovoDep(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addDep()} />
            <button style={btn()} onClick={addDep}><Plus size={14} /> Departamento</button>
          </div>

          {deps.length === 0 && <div style={{ color: CINZA, fontSize: 13, textAlign: "center", padding: 18 }}>Nenhum departamento. Clique em "Restaurar padrão" ou adicione um acima.</div>}

          <div style={{ display: "grid", gap: 8 }}>
            {deps.map((d, di) => {
              const key = d.id ?? `n${di}`;
              const aberto = abertos[key] ?? false;
              return (
                <div key={key} style={{ border: `1px solid ${BORDA}`, borderRadius: 10, background: d.ativo ? "#fff" : "#FAF7FD" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, padding: 8 }}>
                    <button style={{ background: "none", border: "none", cursor: "pointer", color: ROXO }} onClick={() => toggleAberto(key)}>
                      {aberto ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </button>
                    <input style={{ ...inp, flex: 1, opacity: d.ativo ? 1 : 0.6 }} value={d.nome} onChange={(e) => renameDep(di, e.target.value)} />
                    <span style={{ fontSize: 11, color: CINZA }}>{d.setores.length} setor(es)</span>
                    <button title="Subir" style={btn("#fff", ROXO)} onClick={() => moveDep(di, -1)}><ArrowUp size={12} /></button>
                    <button title="Descer" style={btn("#fff", ROXO)} onClick={() => moveDep(di, 1)}><ArrowDown size={12} /></button>
                    <button title={d.ativo ? "Inativar" : "Ativar"} style={btn(d.ativo ? "#fff" : VERDE, d.ativo ? CINZA : "#fff")} onClick={() => toggleDep(di)}><Power size={12} /></button>
                    <button title="Remover" style={btn("#fff", VERMELHO)} onClick={() => removeDep(di)}><X size={12} /></button>
                  </div>
                  {aberto && (
                    <div style={{ padding: "0 10px 10px 32px", display: "grid", gap: 6 }}>
                      {d.setores.map((s, si) => (
                        <div key={s.id ?? `ns${si}`} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <input style={{ ...inp, flex: 1, opacity: s.ativo ? 1 : 0.6 }} value={s.nome} onChange={(e) => renameSetor(di, si, e.target.value)} />
                          <button style={btn("#fff", ROXO)} onClick={() => moveSetor(di, si, -1)}><ArrowUp size={12} /></button>
                          <button style={btn("#fff", ROXO)} onClick={() => moveSetor(di, si, 1)}><ArrowDown size={12} /></button>
                          <button style={btn(s.ativo ? "#fff" : VERDE, s.ativo ? CINZA : "#fff")} onClick={() => toggleSetor(di, si)}><Power size={12} /></button>
                          <button style={btn("#fff", VERMELHO)} onClick={() => removeSetor(di, si)}><X size={12} /></button>
                        </div>
                      ))}
                      <NovoSetor onAdd={(n) => addSetor(di, n)} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function NovoSetor({ onAdd }: { onAdd: (n: string) => void }) {
  const [v, setV] = useState("");
  return (
    <div style={{ display: "flex", gap: 6, marginTop: 4 }}>
      <input style={{ ...inp, flex: 1 }} placeholder="Novo setor…" value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { onAdd(v); setV(""); } }} />
      <button style={btn()} onClick={() => { onAdd(v); setV(""); }}><Plus size={12} /> Setor</button>
    </div>
  );
}
