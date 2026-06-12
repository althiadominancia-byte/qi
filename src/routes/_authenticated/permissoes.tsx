import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ShieldCheck, Save, RotateCcw, CheckCircle2, Info, ChevronDown, Briefcase,
  Users, Crown, ArrowLeft, Loader2, UserCog, UserSearch, Eye,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getMyScope } from "@/lib/scope.functions";
import {
  listPermissoesPapel, savePermissoesPapel,
  listUsuariosDaEmpresa, saveUserOverride, resetUserOverride,
} from "@/lib/permissoes.functions";
import {
  PERM_KEYS, PERM_LABELS, PRESET, ROLES_EDITAVEIS, type PermKey, type RoleKey,
} from "@/lib/recrutamento/perms";
import { ROXO, ROXO_DARK, ROXO_TINT, LARANJA, CINZA, BORDA, VERDE } from "@/lib/recrutamento/data";

export const Route = createFileRoute("/_authenticated/permissoes")({
  head: () => ({ meta: [{ title: "Permissões · Estrela" }] }),
  component: PermissoesPage,
});

const ROLE_META: Record<Exclude<RoleKey, "super_admin">, { nome: string; cor: string; icon: any }> = {
  admin_empresa: { nome: "Admin da Empresa", cor: "#2E8B7A", icon: UserCog },
  recrutador: { nome: "Recrutador", cor: LARANJA, icon: UserSearch },
  visualizador: { nome: "Visualizador", cor: "#3B6FB0", icon: Eye },
};

type Empresa = { id: string; nome: string; ativo: boolean };
type PapelRow = { role: "admin_empresa" | "recrutador" | "visualizador"; perms: Record<string, boolean> };
type UsuarioRow = { id: string; nome: string; email: string; role: RoleKey; perms: Record<string, boolean>; ativo: boolean };

function PermissoesPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const fetchScope = useServerFn(getMyScope);
  const scopeQ = useQuery({ queryKey: ["my-scope"], queryFn: () => fetchScope() });
  const scope = scopeQ.data;
  const isSuper = scope?.role === "super_admin";
  const pode = !!scope && (isSuper || !!scope.perms?.gerenciar_usuarios);

  useEffect(() => {
    if (scopeQ.isSuccess && scope && !pode) navigate({ to: "/admin", replace: true });
  }, [scopeQ.isSuccess, scope, pode, navigate]);

  // Empresa selecionada
  const [empresaId, setEmpresaId] = useState<string>("");
  const empresasQ = useQuery({
    queryKey: ["perm:empresas"],
    enabled: !!scope,
    queryFn: async () => {
      if (isSuper) {
        const { data, error } = await supabase.from("empresas").select("id, nome, ativo").order("nome");
        if (error) throw error;
        return (data ?? []) as Empresa[];
      }
      if (!scope?.empresa_id) return [] as Empresa[];
      const { data, error } = await supabase.from("empresas").select("id, nome, ativo").eq("id", scope.empresa_id);
      if (error) throw error;
      return (data ?? []) as Empresa[];
    },
  });
  useEffect(() => {
    if (!empresaId && empresasQ.data?.length) setEmpresaId(empresasQ.data[0].id);
  }, [empresasQ.data, empresaId]);

  const [aba, setAba] = useState<"papel" | "usuario">("papel");

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", background: "#FBFAFE", minHeight: "100vh", color: ROXO_DARK, paddingBottom: 40 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box} .h{font-family:'Outfit',sans-serif}
        select:focus,input:focus{outline:none;border-color:${ROXO}!important;box-shadow:0 0 0 3px ${ROXO_TINT}}
        @keyframes spin{to{transform:rotate(360deg)}} .spin{animation:spin 1s linear infinite}
      `}</style>

      <div style={{ background: ROXO, padding: "13px 18px", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 30, flexWrap: "wrap" }}>
        <div style={{ lineHeight: 1, minWidth: 0 }}>
          <div className="h" style={{ color: "#fff", fontWeight: 700, letterSpacing: 2, fontSize: 10.5, opacity: 0.85 }}>PLATAFORMA · CONTROLE DE ACESSO</div>
          <div className="h" style={{ color: "#fff", fontWeight: 800, fontSize: 17, display: "flex", alignItems: "center", gap: 7 }}>
            <ShieldCheck size={16} /> Permissões
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {isSuper && empresasQ.data && empresasQ.data.length > 0 && (
            <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
              <span style={{ color: "#fff", fontSize: 11.5, opacity: 0.85, marginRight: 8 }}>Empresa:</span>
              <select value={empresaId} onChange={(e) => setEmpresaId(e.target.value)}
                style={{ appearance: "none", WebkitAppearance: "none", background: "#fff", color: ROXO_DARK, border: "none", borderRadius: 9, padding: "8px 30px 8px 12px", fontSize: 13, fontWeight: 700, fontFamily: "inherit", cursor: "pointer" }}>
                {empresasQ.data.map((e) => <option key={e.id} value={e.id}>{e.nome}{!e.ativo ? " (inativa)" : ""}</option>)}
              </select>
              <ChevronDown size={15} color={ROXO} style={{ position: "absolute", right: 9, pointerEvents: "none" }} />
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 820, margin: "0 auto", padding: "20px 18px", display: "grid", gap: 14 }}>
        <div style={{ background: ROXO_TINT, borderRadius: 13, padding: 15, display: "flex", gap: 11, alignItems: "flex-start" }}>
          <Info size={19} color={ROXO} style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 13, lineHeight: 1.55 }}>
            Defina o <strong>padrão por papel</strong> e, quando precisar, faça o <strong>ajuste por usuário</strong>.
            A permissão efetiva = padrão do papel da empresa, sobrescrito pelos ajustes individuais.
            {isSuper ? "" : " Você gerencia apenas a sua empresa."}
          </div>
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          {([["papel", "Por papel (padrão)", Briefcase], ["usuario", "Por usuário (ajuste)", Users]] as const).map(([k, t, Ic]) => (
            <button key={k} onClick={() => setAba(k)} style={{
              display: "flex", alignItems: "center", gap: 7, padding: "9px 15px", borderRadius: 11, cursor: "pointer", fontFamily: "inherit",
              fontSize: 13.5, fontWeight: 700, border: `1.5px solid ${aba === k ? ROXO : BORDA}`, background: aba === k ? ROXO : "#fff", color: aba === k ? "#fff" : CINZA,
            }}><Ic size={15} /> {t}</button>
          ))}
        </div>

        {empresaId && aba === "papel" && <AbaPapel empresaId={empresaId} qc={qc} />}
        {empresaId && aba === "usuario" && <AbaUsuario empresaId={empresaId} qc={qc} />}
        {!empresaId && <div style={{ background: "#fff", border: `1px dashed ${BORDA}`, borderRadius: 13, padding: 24, textAlign: "center", color: CINZA, fontSize: 13 }}>Selecione uma empresa.</div>}
      </div>
    </div>
  );
}

/* ===================== ABA PAPEL ===================== */
function AbaPapel({ empresaId, qc }: { empresaId: string; qc: ReturnType<typeof useQueryClient> }) {
  const fnList = useServerFn(listPermissoesPapel);
  const fnSave = useServerFn(savePermissoesPapel);
  const papeisQ = useQuery({
    queryKey: ["perm:papel", empresaId],
    queryFn: () => fnList({ data: { empresa_id: empresaId } }) as Promise<PapelRow[]>,
  });

  const [papelSel, setPapelSel] = useState<"admin_empresa" | "recrutador" | "visualizador">("recrutador");
  const [draft, setDraft] = useState<Record<string, Record<string, boolean>>>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [salvoEm, setSalvoEm] = useState<string | null>(null);

  useEffect(() => {
    if (papeisQ.data) {
      const map: Record<string, Record<string, boolean>> = {};
      for (const r of papeisQ.data) map[r.role] = { ...r.perms };
      setDraft(map);
      setDirty(false);
    }
  }, [papeisQ.data]);

  const perms = draft[papelSel] ?? PRESET[papelSel];
  const togglePadrao = (k: PermKey) => {
    setDraft((p) => ({ ...p, [papelSel]: { ...(p[papelSel] ?? PRESET[papelSel]), [k]: !(p[papelSel] ?? PRESET[papelSel])[k] } }));
    setDirty(true); setSalvoEm(null);
  };

  async function salvar() {
    if (!dirty || saving) return;
    setSaving(true);
    try {
      for (const role of ROLES_EDITAVEIS) {
        if (draft[role]) {
          const cleanPerms: Record<string, boolean> = {};
          for (const k of PERM_KEYS) cleanPerms[k] = !!draft[role][k];
          await fnSave({ data: { empresa_id: empresaId, role, perms: cleanPerms } });
        }
      }
      setDirty(false);
      setSalvoEm(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
      qc.invalidateQueries({ queryKey: ["perm:papel", empresaId] });
      qc.invalidateQueries({ queryKey: ["my-scope"] });
    } catch (e: any) {
      alert(e?.message || "Erro ao salvar.");
    } finally { setSaving(false); }
  }

  if (papeisQ.isLoading) return <Loader />;

  return (
    <>
      <SaveBar dirty={dirty} saving={saving} salvoEm={salvoEm} onSave={salvar} />
      <div style={{ background: "#fff", border: `1px solid ${BORDA}`, borderRadius: 16, padding: 18 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          {ROLES_EDITAVEIS.map((rk) => {
            const r = ROLE_META[rk]; const Ic = r.icon; const on = papelSel === rk;
            return (
              <button key={rk} onClick={() => setPapelSel(rk)} style={{
                display: "flex", alignItems: "center", gap: 7, padding: "8px 14px", borderRadius: 99, cursor: "pointer", fontFamily: "inherit",
                fontSize: 13, fontWeight: 700, border: `1.5px solid ${on ? r.cor : BORDA}`, background: on ? r.cor + "14" : "#fff", color: on ? r.cor : CINZA,
              }}><Ic size={14} /> {r.nome}</button>
            );
          })}
        </div>
        <div style={{ fontSize: 12.5, color: CINZA, marginBottom: 6 }}>
          Permissões padrão de <strong style={{ color: ROXO_DARK }}>{ROLE_META[papelSel].nome}</strong> nesta empresa:
        </div>
        <PermList perms={perms} onToggle={togglePadrao} />
        <div style={{ marginTop: 12, background: ROXO_TINT, borderRadius: 10, padding: "10px 13px", fontSize: 12, display: "flex", gap: 8, alignItems: "center" }}>
          <Crown size={15} color={ROXO} /> <strong>Super Admin</strong> tem todas as permissões em todas as empresas (fixo).
        </div>
      </div>
    </>
  );
}

/* ===================== ABA USUÁRIO ===================== */
function AbaUsuario({ empresaId, qc }: { empresaId: string; qc: ReturnType<typeof useQueryClient> }) {
  const fnUsers = useServerFn(listUsuariosDaEmpresa);
  const fnPapel = useServerFn(listPermissoesPapel);
  const fnSave = useServerFn(saveUserOverride);
  const fnReset = useServerFn(resetUserOverride);

  const usersQ = useQuery({
    queryKey: ["perm:users", empresaId],
    queryFn: () => fnUsers({ data: { empresa_id: empresaId } }) as Promise<UsuarioRow[]>,
  });
  const papeisQ = useQuery({
    queryKey: ["perm:papel", empresaId],
    queryFn: () => fnPapel({ data: { empresa_id: empresaId } }) as Promise<PapelRow[]>,
  });

  const [userSel, setUserSel] = useState<string>("");
  const [draftOv, setDraftOv] = useState<Record<string, boolean>>({});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [salvoEm, setSalvoEm] = useState<string | null>(null);

  useEffect(() => {
    if (usersQ.data && !userSel && usersQ.data.length) setUserSel(usersQ.data[0].id);
  }, [usersQ.data, userSel]);
  useEffect(() => {
    const u = usersQ.data?.find((x) => x.id === userSel);
    setDraftOv(u ? { ...(u.perms ?? {}) } : {});
    setDirty(false); setSalvoEm(null);
  }, [userSel, usersQ.data]);

  const userAtual = useMemo(() => usersQ.data?.find((u) => u.id === userSel), [usersQ.data, userSel]);
  const padraoPapel = useMemo(() => {
    if (!userAtual) return {} as Record<string, boolean>;
    const row = papeisQ.data?.find((p) => p.role === userAtual.role);
    return row?.perms ?? PRESET[userAtual.role];
  }, [userAtual, papeisQ.data]);

  const efetivo = (k: PermKey): boolean => (k in draftOv ? !!draftOv[k] : !!padraoPapel[k]);
  const toggleUser = (k: PermKey) => {
    const novo = !efetivo(k);
    setDraftOv((p) => {
      const nv = { ...p };
      if (novo === !!padraoPapel[k]) delete nv[k]; else nv[k] = novo;
      return nv;
    });
    setDirty(true); setSalvoEm(null);
  };
  const resetar = () => { setDraftOv({}); setDirty(true); setSalvoEm(null); };

  async function salvar() {
    if (!dirty || saving || !userAtual) return;
    setSaving(true);
    try {
      if (Object.keys(draftOv).length === 0) {
        await fnReset({ data: { user_id: userAtual.id } });
      } else {
        await fnSave({ data: { user_id: userAtual.id, perms: draftOv } });
      }
      setDirty(false);
      setSalvoEm(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
      qc.invalidateQueries({ queryKey: ["perm:users", empresaId] });
      qc.invalidateQueries({ queryKey: ["my-scope"] });
    } catch (e: any) {
      alert(e?.message || "Erro ao salvar.");
    } finally { setSaving(false); }
  }

  const nOver = Object.keys(draftOv).length;

  if (usersQ.isLoading || papeisQ.isLoading) return <Loader />;
  if (!usersQ.data?.length) return <div style={{ background: "#fff", border: `1px dashed ${BORDA}`, borderRadius: 13, padding: 24, textAlign: "center", color: CINZA, fontSize: 13 }}>Nenhum usuário nesta empresa.</div>;

  return (
    <>
      <SaveBar dirty={dirty} saving={saving} salvoEm={salvoEm} onSave={salvar} />
      <div style={{ background: "#fff", border: `1px solid ${BORDA}`, borderRadius: 16, padding: 18 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
          <div style={{ position: "relative", flex: "1 1 240px" }}>
            <select value={userSel} onChange={(e) => setUserSel(e.target.value)} style={{
              width: "100%", appearance: "none", WebkitAppearance: "none", border: `1.5px solid ${BORDA}`, borderRadius: 10,
              padding: "10px 32px 10px 12px", fontSize: 13.5, fontWeight: 600, fontFamily: "inherit", color: ROXO_DARK, background: "#fff", cursor: "pointer",
            }}>
              {usersQ.data.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nome || u.email} — {ROLE_META[u.role as keyof typeof ROLE_META]?.nome ?? u.role}{!u.ativo ? " (inativo)" : ""}
                </option>
              ))}
            </select>
            <ChevronDown size={16} color="#9b93b0" style={{ position: "absolute", right: 11, top: 13, pointerEvents: "none" }} />
          </div>
          <button onClick={resetar} disabled={nOver === 0}
            style={{ background: "#fff", color: ROXO, border: `1.5px solid ${BORDA}`, padding: "10px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit", cursor: nOver === 0 ? "default" : "pointer", opacity: nOver === 0 ? 0.5 : 1 }}>
            <RotateCcw size={14} /> Resetar para o papel
          </button>
        </div>

        {userAtual && (
          <>
            <div style={{ fontSize: 12.5, color: CINZA, marginBottom: 6 }}>
              Permissão efetiva de <strong style={{ color: ROXO_DARK }}>{userAtual.nome || userAtual.email}</strong>
              {nOver > 0 && <span style={{ color: LARANJA, fontWeight: 700 }}> · {nOver} ajuste(s)</span>}
            </div>
            <div style={{ border: `1px solid ${BORDA}`, borderRadius: 12, overflow: "hidden" }}>
              {PERM_KEYS.map((k, i) => {
                const ajustado = k in draftOv;
                const on = efetivo(k);
                return (
                  <div key={k} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderBottom: i < PERM_KEYS.length - 1 ? `1px solid ${BORDA}` : "none", background: on ? "#fff" : "#FBFAFE" }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: ROXO_DARK }}>{PERM_LABELS[k].nome}</div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: ajustado ? LARANJA : "#9b93b0" }}>
                        {ajustado ? "ajustado" : "herdado do papel"}
                      </div>
                    </div>
                    <Switch on={on} onClick={() => toggleUser(k)} />
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </>
  );
}

/* ===================== shared ===================== */
function PermList({ perms, onToggle }: { perms: Record<string, boolean>; onToggle: (k: PermKey) => void }) {
  return (
    <div style={{ border: `1px solid ${BORDA}`, borderRadius: 12, overflow: "hidden" }}>
      {PERM_KEYS.map((k, i) => (
        <div key={k} style={{ display: "flex", alignItems: "center", gap: 10, padding: "11px 14px", borderBottom: i < PERM_KEYS.length - 1 ? `1px solid ${BORDA}` : "none", background: perms[k] ? "#fff" : "#FBFAFE" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 600, color: ROXO_DARK }}>{PERM_LABELS[k].nome}</div>
            {PERM_LABELS[k].desc && <div style={{ fontSize: 11, color: "#9b93b0" }}>{PERM_LABELS[k].desc}</div>}
          </div>
          <Switch on={!!perms[k]} onClick={() => onToggle(k)} />
        </div>
      ))}
    </div>
  );
}

function SaveBar({ dirty, saving, salvoEm, onSave }: { dirty: boolean; saving: boolean; salvoEm: string | null; onSave: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", border: `1.5px solid ${dirty ? LARANJA + "66" : VERDE + "55"}`, borderRadius: 13, padding: "12px 15px", flexWrap: "wrap" }}>
      {dirty
        ? <span style={{ fontSize: 13, color: ROXO_DARK, fontWeight: 600 }}>Há alterações não salvas.</span>
        : <span style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 13, color: VERDE, fontWeight: 700 }}><CheckCircle2 size={16} /> Permissões salvas{salvoEm ? ` às ${salvoEm}` : ""}.</span>}
      <button onClick={onSave} disabled={!dirty || saving}
        style={{ marginLeft: "auto", background: dirty ? LARANJA : "#D8D2E6", color: "#fff", border: "none", padding: "10px 18px", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: dirty && !saving ? "pointer" : "default", display: "flex", alignItems: "center", gap: 7, fontFamily: "inherit" }}>
        {saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />} Salvar permissões
      </button>
    </div>
  );
}

function Switch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on}
      style={{ width: 42, height: 24, borderRadius: 99, border: "none", flexShrink: 0, position: "relative", background: on ? VERDE : "#CBD5E1", cursor: "pointer", transition: "background .15s" }}>
      <span style={{ position: "absolute", top: 3, left: on ? 21 : 3, width: 18, height: 18, borderRadius: 99, background: "#fff", transition: "left .15s", boxShadow: "0 1px 3px rgba(0,0,0,.3)" }} />
    </button>
  );
}

function Loader() {
  return <div style={{ padding: 30, textAlign: "center", color: CINZA, fontSize: 13 }}><Loader2 size={18} className="spin" /> Carregando…</div>;
}
