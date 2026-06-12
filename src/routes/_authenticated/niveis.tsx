import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ChevronLeft, Plus, X, Save, Power, ArrowUp, ArrowDown, Building2, Loader2, Crown, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getMyScope } from "@/lib/scope.functions";
import { salvarNiveisLideranca } from "@/lib/niveis-lideranca.functions";
import { ROXO, ROXO_DARK, BORDA, CINZA, LARANJA, VERDE, VERMELHO } from "@/lib/recrutamento/data";
import { MarcaEstrela } from "@/components/MarcaEstrela";

type Search = { empresa?: string };
export const Route = createFileRoute("/_authenticated/niveis")({
  head: () => ({ meta: [{ title: "Níveis de Liderança" }] }),
  validateSearch: (s: Record<string, unknown>): Search => ({ empresa: typeof s.empresa === "string" ? s.empresa : undefined }),
  component: NiveisPage,
});

type Item = { id?: string; nome: string; ordem: number; ativo: boolean; _novo?: boolean };

const inp: React.CSSProperties = { padding: "8px 10px", border: `1.5px solid ${BORDA}`, borderRadius: 8, fontSize: 13, outline: "none", background: "#fff", color: ROXO_DARK, fontFamily: "inherit" };
const btn = (bg = ROXO, fg = "#fff"): React.CSSProperties => ({ background: bg, color: fg, border: "none", padding: "8px 12px", borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6, fontFamily: "inherit" });

function move<T>(arr: T[], i: number, dir: number): T[] {
  const j = i + dir; if (j < 0 || j >= arr.length) return arr;
  const a = [...arr]; [a[i], a[j]] = [a[j], a[i]]; return a;
}

function NiveisPage() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const fetchScope = useServerFn(getMyScope);
  const scopeQ = useQuery({ queryKey: ["my-scope"], queryFn: () => fetchScope() });
  const scope = scopeQ.data;
  const isSuper = scope?.role === "super_admin";
  const empresaId = isSuper ? (search.empresa ?? null) : (scope?.empresa_id ?? null);

  const callSave = useServerFn(salvarNiveisLideranca);

  const empresaQ = useQuery({
    queryKey: ["empresa", empresaId],
    queryFn: async () => {
      const { data } = await supabase.from("empresas").select("id,nome").eq("id", empresaId!).maybeSingle();
      return data;
    },
    enabled: !!empresaId,
  });

  const dataQ = useQuery({
    queryKey: ["niveis-lid", empresaId],
    queryFn: async () => {
      const { data } = await supabase.from("niveis_lideranca").select("id,nome,ordem,ativo").eq("empresa_id", empresaId!).order("ordem").order("nome");
      return (data ?? []) as Item[];
    },
    enabled: !!empresaId,
  });

  const [itens, setItens] = useState<Item[]>([]);
  const [removidos, setRemovidos] = useState<string[]>([]);
  const [novo, setNovo] = useState("");
  const [dirty, setDirty] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [salvoEm, setSalvoEm] = useState<Date | null>(null);
  const [erro, setErro] = useState("");

  useEffect(() => {
    if (dataQ.data) { setItens(dataQ.data); setRemovidos([]); setDirty(false); setSalvoEm(null); }
  }, [dataQ.data]);

  const mut = (fn: (p: Item[]) => Item[]) => { setItens(fn); setDirty(true); setSalvoEm(null); };

  const addItem = () => {
    if (!novo.trim()) return;
    mut((p) => [...p, { nome: novo.trim(), ordem: p.length, ativo: true, _novo: true }]);
    setNovo("");
  };
  const rename = (i: number, nome: string) => mut((p) => p.map((it, k) => k === i ? { ...it, nome } : it));
  const toggle = (i: number) => mut((p) => p.map((it, k) => k === i ? { ...it, ativo: !it.ativo } : it));
  const remover = (i: number) => {
    const it = itens[i];
    if (!confirm(`Remover o nível "${it.nome}"? Líderes já cadastrados mantêm o rótulo, mas o item deixa de aparecer no cadastro.`)) return;
    if (it.id) setRemovidos((r) => [...r, it.id!]);
    mut((p) => p.filter((_, k) => k !== i));
  };
  const moverItem = (i: number, dir: number) => mut((p) => move(p, i, dir));

  async function salvar() {
    if (!empresaId) return;
    const nomes = itens.map((i) => i.nome.trim().toLowerCase());
    const dup = nomes.find((n, i) => nomes.indexOf(n) !== i);
    if (dup) { setErro(`Há nomes duplicados: "${dup}".`); return; }
    if (nomes.some((n) => !n)) { setErro("Há níveis sem nome."); return; }
    setSalvando(true); setErro("");
    try {
      await callSave({
        data: {
          empresa_id: empresaId,
          itens: itens.map((it, i) => ({ id: it.id || undefined, nome: it.nome.trim(), ordem: i, ativo: it.ativo })),
          remover: removidos,
        },
      });
      setDirty(false); setSalvoEm(new Date()); setRemovidos([]);
      dataQ.refetch();
    } catch (e: any) { setErro(e.message || "Falha ao salvar"); }
    finally { setSalvando(false); }
  }

  if (!scopeQ.isSuccess) return <div style={{ padding: 24, color: CINZA }}>Carregando…</div>;
  if (!empresaId) return (
    <div style={{ padding: 24 }}>
      <p style={{ color: CINZA }}>Selecione uma empresa em Administração antes de gerenciar os níveis.</p>
      <button style={btn()} onClick={() => navigate({ to: "/super" })}>Ir para Administração</button>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#FAFAFC" }}>
      <header style={{ background: ROXO, color: "#fff", padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
        <MarcaEstrela size={28} branca />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>Níveis de Liderança</div>
          <div style={{ fontSize: 12, opacity: 0.85, display: "flex", alignItems: "center", gap: 6 }}>
            <Building2 size={13} /> {empresaQ.data?.nome ?? "—"}
          </div>
        </div>
        <button style={btn("rgba(255,255,255,.15)")} onClick={() => navigate({ to: "/admin", search: { empresa: empresaId } })}>
          <ChevronLeft size={14} /> Voltar
        </button>
      </header>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: 18, display: "grid", gap: 14 }}>
        {erro && <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", color: "#B91C1C", padding: 10, borderRadius: 10, fontSize: 13 }}>{erro}</div>}

        <div style={{ background: "#fff", border: `1px solid ${BORDA}`, borderRadius: 12, padding: 14, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <Crown size={18} color={ROXO} />
          <div style={{ flex: 1, fontSize: 13, color: ROXO_DARK }}>
            Defina os níveis disponíveis no cadastro de líderes (ex.: Gestor, Coordenador, Supervisor, Diretor…).
            {dirty && <strong style={{ marginLeft: 6, color: LARANJA }}>· alterações não salvas</strong>}
            {salvoEm && !dirty && <span style={{ marginLeft: 6, color: VERDE, display: "inline-flex", alignItems: "center", gap: 4 }}><CheckCircle2 size={13} /> salvo</span>}
          </div>
          <button style={btn(LARANJA)} onClick={salvar} disabled={!dirty || salvando}>
            {salvando ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Salvar
          </button>
        </div>

        <div style={{ background: "#fff", border: `1px solid ${BORDA}`, borderRadius: 12, padding: 14 }}>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input style={{ ...inp, flex: 1 }} placeholder="Novo nível (ex: Diretor)…" value={novo} onChange={(e) => setNovo(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addItem()} />
            <button style={btn()} onClick={addItem}><Plus size={14} /> Adicionar</button>
          </div>

          {itens.length === 0 && <div style={{ color: CINZA, fontSize: 13, textAlign: "center", padding: 18 }}>Nenhum nível cadastrado.</div>}

          <div style={{ display: "grid", gap: 8 }}>
            {itens.map((it, i) => (
              <div key={it.id ?? `n${i}`} style={{ display: "flex", alignItems: "center", gap: 6, padding: 8, border: `1px solid ${BORDA}`, borderRadius: 10, background: it.ativo ? "#fff" : "#FAF7FD" }}>
                <input style={{ ...inp, flex: 1, opacity: it.ativo ? 1 : 0.6 }} value={it.nome} onChange={(e) => rename(i, e.target.value)} />
                <button title="Subir" style={btn("#fff", ROXO)} onClick={() => moverItem(i, -1)}><ArrowUp size={12} /></button>
                <button title="Descer" style={btn("#fff", ROXO)} onClick={() => moverItem(i, 1)}><ArrowDown size={12} /></button>
                <button title={it.ativo ? "Inativar" : "Ativar"} style={btn(it.ativo ? "#fff" : VERDE, it.ativo ? CINZA : "#fff")} onClick={() => toggle(i)}><Power size={12} /></button>
                <button title="Remover" style={btn("#fff", VERMELHO)} onClick={() => remover(i)}><X size={12} /></button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
