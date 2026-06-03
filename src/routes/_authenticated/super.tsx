import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Building2, Users, Plus, X, ShieldCheck, ChevronDown, ChevronRight, MapPin,
  Save, Crown, UserCog, UserSearch, Eye, Pencil, Power, Layers, LogOut,
  Headphones, Loader2, ArrowRight,
} from "lucide-react";
import { MarcaEstrela } from "@/components/MarcaEstrela";
import { supabase } from "@/integrations/supabase/client";
import { getMyScope } from "@/lib/scope.functions";
import { createUserInvite, updateUser, toggleUserAtivo } from "@/lib/admin-users.functions";
import { PERM_KEYS, PERM_LABELS, ROLES, ORDEM_ROLES, PRESET, type RoleKey, type PermKey } from "@/lib/recrutamento/perms";
import {
  ROXO, ROXO_DARK, ROXO_TINT, LARANJA, CINZA, BORDA, VERDE, VERMELHO,
} from "@/lib/recrutamento/data";

export const Route = createFileRoute("/_authenticated/super")({
  head: () => ({ meta: [{ title: "Super Admin · Estrela" }] }),
  component: SuperAdminPage,
});

const ROLE_ICONS: Record<RoleKey, any> = {
  super_admin: Crown, admin_empresa: UserCog, recrutador: UserSearch, visualizador: Eye,
};

type Empresa = { id: string; nome: string; cnpj: string | null; ativo: boolean };
type Unidade = { id: string; empresa_id: string; nome: string; tipo: "matriz" | "filial"; cidade: string | null };
type Usuario = {
  id: string; nome: string; email: string; role: RoleKey;
  empresa_id: string | null; todas_unidades: boolean; perms: Record<string, boolean>;
  ativo: boolean;
};
type UsuarioEdit = Usuario & { unidades: string[]; _novo?: boolean };

function SuperAdminPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchScope = useServerFn(getMyScope);
  const scopeQ = useQuery({ queryKey: ["my-scope"], queryFn: () => fetchScope() });
  const scope = scopeQ.data;

  const podeGerenciar =
    !!scope &&
    (scope.role === "super_admin" || !!scope.perms?.gerenciar_usuarios);
  const isSuper = scope?.role === "super_admin";

  useEffect(() => {
    if (scopeQ.isSuccess && scope && !podeGerenciar) {
      navigate({ to: "/admin", replace: true });
    }
  }, [scopeQ.isSuccess, scope, podeGerenciar, navigate]);

  const enabled = podeGerenciar;


  const empresasQ = useQuery({
    queryKey: ["super:empresas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("empresas").select("*").order("created_at");
      if (error) throw error;
      return (data ?? []) as Empresa[];
    },
    enabled,
  });
  const unidadesQ = useQuery({
    queryKey: ["super:unidades"],
    queryFn: async () => {
      const { data, error } = await supabase.from("unidades").select("*").order("created_at");
      if (error) throw error;
      return (data ?? []) as Unidade[];
    },
    enabled,
  });
  const usuariosQ = useQuery({
    queryKey: ["super:usuarios"],
    queryFn: async () => {
      const { data, error } = await supabase.from("usuarios").select("*").order("created_at");
      if (error) throw error;
      return (data ?? []) as any as Usuario[];
    },
    enabled,
  });
  const userUnidadesQ = useQuery({
    queryKey: ["super:user_unidades"],
    queryFn: async () => {
      const { data, error } = await supabase.from("usuario_unidades").select("*");
      if (error) throw error;
      return (data ?? []) as { usuario_id: string; unidade_id: string }[];
    },
    enabled,
  });

  const empresas = empresasQ.data ?? [];
  const unidades = unidadesQ.data ?? [];
  const usuarios = usuariosQ.data ?? [];
  const userUnidades = userUnidadesQ.data ?? [];

  const [aba, setAba] = useState<"usuarios" | "empresas">("usuarios");
  const [editUser, setEditUser] = useState<UsuarioEdit | null>(null);

  const nomeEmpresa = (id: string | null) => empresas.find((e) => e.id === id)?.nome || "—";
  const unidadesDe = (id: string | null) => unidades.filter((u) => u.empresa_id === id);
  const unidadesUsuario = (uid: string) => userUnidades.filter((x) => x.usuario_id === uid).map((x) => x.unidade_id);

  async function sair() { await supabase.auth.signOut(); navigate({ to: "/auth", replace: true }); }

  function abrirPainel(e: Empresa) {
    try { sessionStorage.setItem("empresa_ativa_id", e.id); } catch {}
    navigate({ to: "/admin", search: { empresa: e.id } });
  }

  if (scopeQ.isLoading) {
    return <div style={{ padding: 40, textAlign: "center", color: CINZA, fontFamily: "system-ui" }}>Carregando...</div>;
  }
  if (scope && !podeGerenciar) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: VERMELHO, fontFamily: "system-ui" }}>
        Acesso restrito a administradores.
      </div>
    );
  }


  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", background: "#FBFAFE", minHeight: "100vh", color: ROXO_DARK, paddingBottom: 40 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box} html,body{overflow-x:hidden} .h{font-family:'Outfit',sans-serif}
        input:focus,select:focus,textarea:focus{outline:none;border-color:${ROXO}!important;box-shadow:0 0 0 3px ${ROXO_TINT}}
        @keyframes spin{to{transform:rotate(360deg)}} .spin{animation:spin 1s linear infinite}
        @media(max-width:640px){
          [data-pad]{padding:0 12px!important}
          [data-grid2]{grid-template-columns:1fr!important}
          [data-userrow]{flex-wrap:wrap!important}
          [data-userrow] > [data-userrole]{order:5;width:100%}
          [data-empinp]{grid-template-columns:1fr!important}
        }
      `}</style>

      <div style={{ background: ROXO, padding: "13px 18px", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 30 }}>
        <MarcaEstrela size={32} branca />
        <div style={{ lineHeight: 1, minWidth: 0 }}>
          <div className="h" style={{ color: "#fff", fontWeight: 700, letterSpacing: 2, fontSize: 10.5, opacity: 0.85 }}>PLATAFORMA · RECRUTAMENTO</div>
          <div className="h" style={{ color: "#fff", fontWeight: 800, fontSize: 17, display: "flex", alignItems: "center", gap: 7 }}>
            {isSuper ? <Crown size={16} /> : <UserCog size={16} />} {isSuper ? "Super Admin" : "Administração"}
          </div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ color: "#fff", fontSize: 12, opacity: 0.85, display: "flex", alignItems: "center", gap: 6 }}>
            <Headphones size={14} /> {isSuper ? "Controle global" : scope?.empresa_nome || "Sua empresa"}
          </span>

          <button onClick={sair} style={{ background: "rgba(255,255,255,.15)", color: "#fff", border: "none", padding: "8px 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
            <LogOut size={13} /> Sair
          </button>
        </div>
      </div>

      <div data-pad style={{ maxWidth: 940, margin: "0 auto", padding: "0 18px" }}>
        <div style={{ display: "flex", gap: 6, margin: "18px 0", flexWrap: "wrap" }}>
          {(isSuper
            ? ([["usuarios", "Usuários", Users], ["empresas", "Empresas & unidades", Building2]] as const)
            : ([["usuarios", "Usuários", Users]] as const)
          ).map(([k, t, Ic]) => (
            <button key={k} onClick={() => setAba(k as any)} style={{
              display: "flex", alignItems: "center", gap: 7, padding: "9px 16px", borderRadius: 11, cursor: "pointer", fontFamily: "inherit",
              fontSize: 13.5, fontWeight: 700, border: `1.5px solid ${aba === k ? ROXO : BORDA}`, background: aba === k ? ROXO : "#fff", color: aba === k ? "#fff" : CINZA,
            }}><Ic size={15} /> {t}</button>
          ))}
        </div>


        {aba === "usuarios" && (
          <UsuariosTab
            usuarios={usuarios} loading={usuariosQ.isLoading}
            nomeEmpresa={nomeEmpresa}
            unidadesUsuario={unidadesUsuario}
            onNovo={() => setEditUser({
              id: "", nome: "", email: "", role: "recrutador",
              empresa_id: isSuper ? (empresas[0]?.id ?? null) : (scope?.empresa_id ?? null),
              todas_unidades: true,
              perms: { ...PRESET.recrutador }, ativo: true, unidades: [], _novo: true,
            })}

            onEditar={(u: Usuario) => setEditUser({ ...u, unidades: unidadesUsuario(u.id) })}
            onToggle={async (u: Usuario) => {
              try {
                await toggleUserAtivo({ data: { id: u.id, ativo: !u.ativo } });
                qc.invalidateQueries({ queryKey: ["super:usuarios"] });
              } catch (e: any) { alert(e.message); }
            }}
          />
        )}

        {aba === "empresas" && (
          <EmpresasTab
            empresas={empresas} unidades={unidades}
            loading={empresasQ.isLoading}
            onAbrirPainel={abrirPainel}
            onChanged={() => { qc.invalidateQueries({ queryKey: ["super:empresas"] }); qc.invalidateQueries({ queryKey: ["super:unidades"] }); }}
          />
        )}
      </div>

      {editUser && (
        <UsuarioModal
          user={editUser} empresas={empresas} unidadesDe={unidadesDe} viewerIsSuper={isSuper}

          onClose={() => setEditUser(null)}
          onSaved={() => {
            setEditUser(null);
            qc.invalidateQueries({ queryKey: ["super:usuarios"] });
            qc.invalidateQueries({ queryKey: ["super:user_unidades"] });
          }}
        />
      )}
    </div>
  );
}

/* ====================== USUÁRIOS ====================== */
function UsuariosTab({ usuarios, loading, nomeEmpresa, unidadesUsuario, onNovo, onEditar, onToggle }: any) {
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 8, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, color: CINZA }}>
          {loading ? "Carregando..." : `${usuarios.length} usuário(s) · ${usuarios.filter((u: Usuario) => u.ativo).length} ativo(s)`}
        </div>
        <button onClick={onNovo} style={btnLaranja}><Plus size={16} /> Novo usuário</button>
      </div>
      <div style={{ display: "grid", gap: 9 }}>
        {usuarios.map((u: Usuario) => {
          const role = ROLES[u.role]; const Ic = ROLE_ICONS[u.role];
          const escopo = u.role === "super_admin"
            ? "Todas as empresas"
            : `${nomeEmpresa(u.empresa_id)} · ${u.todas_unidades ? "todas as unidades" : `${unidadesUsuario(u.id).length} unidade(s)`}`;
          const iniciais = (u.nome || u.email).split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
          return (
            <div key={u.id} data-userrow style={{ background: "#fff", border: `1px solid ${BORDA}`, borderRadius: 13, padding: "13px 16px", display: "flex", alignItems: "center", gap: 13, opacity: u.ativo ? 1 : 0.55 }}>
              <div className="h" style={{ width: 42, height: 42, borderRadius: 99, background: role.cor + "18", color: role.cor, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, flexShrink: 0 }}>{iniciais}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="h" style={{ fontWeight: 700, fontSize: 15 }}>
                  {u.nome || "(sem nome)"} {!u.ativo && <span style={{ fontSize: 11, color: VERMELHO, fontWeight: 700 }}>· inativo</span>}
                </div>
                <div style={{ fontSize: 12, color: "#9b93b0" }}>{u.email}</div>
                <div style={{ fontSize: 11.5, color: CINZA, marginTop: 3 }}>{escopo}</div>
              </div>
              <span data-userrole style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, color: role.cor, background: role.cor + "18", padding: "4px 10px", borderRadius: 99, flexShrink: 0 }}>
                <Ic size={13} /> {role.nome}
              </span>
              <button onClick={() => onToggle(u)} title={u.ativo ? "Desativar" : "Ativar"} style={{ ...iconBtn, color: u.ativo ? VERDE : "#9b93b0" }}><Power size={16} /></button>
              <button onClick={() => onEditar(u)} title="Editar" style={iconBtn}><Pencil size={15} /></button>
            </div>
          );
        })}
        {!loading && usuarios.length === 0 && (
          <div style={{ background: "#fff", border: `1px dashed ${BORDA}`, borderRadius: 13, padding: 24, textAlign: "center", color: CINZA, fontSize: 13 }}>
            Nenhum usuário cadastrado.
          </div>
        )}
      </div>
    </>
  );
}

function UsuarioModal({ user, empresas, unidadesDe, viewerIsSuper, onClose, onSaved }: any) {
  const [u, setU] = useState<UsuarioEdit>(user);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof UsuarioEdit, v: any) => setU((p) => ({ ...p, [k]: v }));
  const setRole = (role: RoleKey) => setU((p) => ({ ...p, role, perms: { ...PRESET[role] } }));
  const togglePerm = (key: PermKey) => setU((p) => ({ ...p, perms: { ...p.perms, [key]: !p.perms[key] } }));
  const toggleUnidade = (id: string) => setU((p) => ({ ...p, unidades: p.unidades.includes(id) ? p.unidades.filter((x) => x !== id) : [...p.unidades, id] }));

  const isSuper = u.role === "super_admin";
  const unidades = unidadesDe(u.empresa_id);
  const ajustado = JSON.stringify(u.perms) !== JSON.stringify(PRESET[u.role]);
  const podeSalvar = u.nome.trim() && u.email.trim() && (isSuper || u.empresa_id);

  const fnCreate = useServerFn(createUserInvite);
  const fnUpdate = useServerFn(updateUser);

  async function salvar() {
    if (!podeSalvar || saving) return;
    setSaving(true);
    try {
      const payload = {
        nome: u.nome.trim(), email: u.email.trim().toLowerCase(),
        role: u.role, empresa_id: isSuper ? null : u.empresa_id,
        todas_unidades: u.todas_unidades, unidades: isSuper ? [] : u.unidades,
        perms: u.perms, ativo: u.ativo,
      };
      if (user._novo) {
        await fnCreate({ data: payload });
      } else {
        await fnUpdate({ data: { id: u.id, ...payload } });
      }
      onSaved();
    } catch (e: any) {
      alert(e?.message || "Erro ao salvar usuário");
    } finally { setSaving(false); }
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(58,37,102,.45)", display: "flex", alignItems: "flex-start", justifyContent: "center", padding: 18, zIndex: 50, overflowY: "auto" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(560px,100%)", background: "#fff", borderRadius: 18, overflow: "hidden", boxShadow: "0 30px 70px -20px rgba(0,0,0,.4)", margin: "10px 0" }}>
        <div style={{ background: ROXO, padding: "16px 20px", display: "flex", alignItems: "center", gap: 10 }}>
          <UserCog size={20} color="#fff" />
          <div className="h" style={{ color: "#fff", fontWeight: 800, fontSize: 17, flex: 1 }}>{user._novo ? "Novo usuário" : "Editar usuário"}</div>
          <button onClick={onClose} style={{ background: "rgba(255,255,255,.18)", border: "none", borderRadius: 9, width: 32, height: 32, cursor: "pointer", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={17} /></button>
        </div>

        <div style={{ padding: 20, maxHeight: "70vh", overflowY: "auto" }}>
          <div data-grid2 style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Campo label="Nome completo"><input style={inp} value={u.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Nome" /></Campo>
            <Campo label="E-mail (login)"><input style={inp} type="email" value={u.email} onChange={(e) => set("email", e.target.value)} placeholder="email@empresa.com" disabled={!user._novo} /></Campo>
          </div>

          <Campo label="Papel (função)">
            <div data-grid2 style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {ORDEM_ROLES.map((rk) => {
                const r = ROLES[rk]; const Ic = ROLE_ICONS[rk]; const on = u.role === rk;
                return (
                  <button key={rk} onClick={() => setRole(rk)} style={{
                    textAlign: "left", padding: "10px 12px", borderRadius: 11, cursor: "pointer", fontFamily: "inherit",
                    border: `1.5px solid ${on ? r.cor : BORDA}`, background: on ? r.cor + "12" : "#fff",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 7, fontWeight: 700, fontSize: 13, color: on ? r.cor : ROXO_DARK }}><Ic size={14} /> {r.nome}</div>
                    <div style={{ fontSize: 11, color: CINZA, marginTop: 3, lineHeight: 1.4 }}>{r.desc}</div>
                  </button>
                );
              })}
            </div>
          </Campo>

          {!isSuper && (
            <>
              <Campo label="Empresa">
                <select style={inp} value={u.empresa_id || ""} onChange={(e) => set("empresa_id", e.target.value)}>
                  <option value="">Selecione...</option>
                  {empresas.map((e: Empresa) => <option key={e.id} value={e.id}>{e.nome}</option>)}
                </select>
              </Campo>
              <Campo label="Acesso às unidades">
                <label style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, color: ROXO_DARK, marginBottom: 10, cursor: "pointer" }}>
                  <Switch on={u.todas_unidades} onClick={() => set("todas_unidades", !u.todas_unidades)} />
                  Todas as unidades da empresa (matriz + filiais)
                </label>
                {!u.todas_unidades && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                    {unidades.map((un: Unidade) => {
                      const on = u.unidades.includes(un.id);
                      return (
                        <button key={un.id} onClick={() => toggleUnidade(un.id)} style={{
                          padding: "7px 12px", borderRadius: 99, fontSize: 12.5, cursor: "pointer", fontFamily: "inherit",
                          border: `1.5px solid ${on ? ROXO : BORDA}`, background: on ? ROXO_TINT : "#fff", color: on ? ROXO_DARK : CINZA, fontWeight: on ? 700 : 500,
                        }}>{un.tipo === "matriz" ? "★ " : ""}{un.nome}</button>
                      );
                    })}
                    {unidades.length === 0 && <span style={{ fontSize: 12, color: "#9b93b0" }}>Sem unidades nesta empresa.</span>}
                  </div>
                )}
              </Campo>
            </>
          )}
          {isSuper && (
            <div style={{ background: ROXO_TINT, borderRadius: 11, padding: 12, fontSize: 12.5, color: ROXO_DARK, display: "flex", gap: 9, marginBottom: 16 }}>
              <Crown size={17} color={ROXO} style={{ flexShrink: 0 }} /> Super Admin tem acesso a <strong>todas as empresas e unidades</strong> automaticamente.
            </div>
          )}

          <Campo label={`Permissões${ajustado ? " (ajustado)" : " (padrão do papel)"}`}>
            <div style={{ border: `1px solid ${BORDA}`, borderRadius: 12, overflow: "hidden" }}>
              {PERM_KEYS.map((k, i) => (
                <div key={k} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 13px", borderBottom: i < PERM_KEYS.length - 1 ? `1px solid ${BORDA}` : "none", background: u.perms[k] ? "#fff" : "#FBFAFE" }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: ROXO_DARK }}>{PERM_LABELS[k].nome}</div>
                    {PERM_LABELS[k].desc && <div style={{ fontSize: 11, color: "#9b93b0" }}>{PERM_LABELS[k].desc}</div>}
                  </div>
                  <Switch on={!!u.perms[k]} onClick={() => togglePerm(k)} disabled={isSuper} />
                </div>
              ))}
            </div>
            {isSuper && <div style={{ fontSize: 11, color: "#9b93b0", marginTop: 7 }}>Super Admin tem todas as permissões fixas.</div>}
          </Campo>

          <label style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, color: ROXO_DARK, marginTop: 4, cursor: "pointer" }}>
            <Switch on={u.ativo} onClick={() => set("ativo", !u.ativo)} /> Usuário ativo
          </label>
        </div>

        <div style={{ padding: "14px 20px", borderTop: `1px solid ${BORDA}`, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ fontSize: 11.5, color: "#9b93b0" }}>{user._novo ? "Um convite de acesso é enviado ao e-mail." : ""}</span>
          <div style={{ display: "flex", gap: 9 }}>
            <button onClick={onClose} style={btnSec}>Cancelar</button>
            <button onClick={salvar} disabled={!podeSalvar || saving} style={{ ...btnLaranja, opacity: podeSalvar && !saving ? 1 : 0.5, cursor: podeSalvar && !saving ? "pointer" : "not-allowed" }}>
              {saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />} Salvar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ====================== EMPRESAS ====================== */
function EmpresasTab({ empresas, unidades, loading, onAbrirPainel, onChanged }: any) {
  const [aberta, setAberta] = useState<string | null>(empresas[0]?.id ?? null);
  useEffect(() => { if (!aberta && empresas[0]) setAberta(empresas[0].id); }, [empresas, aberta]);

  const [novaEmp, setNovaEmp] = useState(false);
  const [en, setEn] = useState(""); const [ec, setEc] = useState(""); const [em, setEm] = useState("");
  const [criando, setCriando] = useState(false);

  async function criarEmpresa() {
    if (!en.trim() || criando) return;
    setCriando(true);
    try {
      const { data: emp, error } = await supabase.from("empresas").insert({ nome: en.trim(), cnpj: ec.trim() || null }).select().single();
      if (error) throw error;
      const matrizNome = em.trim() || "Matriz";
      const { error: e2 } = await supabase.from("unidades").insert({ empresa_id: emp.id, nome: matrizNome, tipo: "matriz" });
      if (e2) throw e2;
      setEn(""); setEc(""); setEm(""); setNovaEmp(false);
      onChanged();
    } catch (e: any) { alert(e.message); }
    finally { setCriando(false); }
  }

  async function toggleEmpresa(emp: Empresa) {
    const { error } = await supabase.from("empresas").update({ ativo: !emp.ativo }).eq("id", emp.id);
    if (error) { alert(error.message); return; }
    onChanged();
  }

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 8, flexWrap: "wrap" }}>
        <div style={{ fontSize: 13, color: CINZA }}>{loading ? "Carregando..." : `${empresas.length} empresa(s)`}</div>
        <button onClick={() => setNovaEmp((v) => !v)} style={btnLaranja}><Plus size={16} /> Nova empresa</button>
      </div>

      {novaEmp && (
        <div style={{ background: "#fff", border: `1.5px solid ${ROXO}55`, borderRadius: 14, padding: 16, marginBottom: 14 }}>
          <div className="h" style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>Cadastrar empresa</div>
          <div data-empinp style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <Campo label="Nome da empresa"><input style={inp} value={en} onChange={(e) => setEn(e.target.value)} /></Campo>
            <Campo label="CNPJ"><input style={inp} value={ec} onChange={(e) => setEc(e.target.value)} placeholder="00.000.000/0001-00" /></Campo>
            <Campo label="Nome da matriz"><input style={inp} value={em} onChange={(e) => setEm(e.target.value)} placeholder="Matriz — Cidade" /></Campo>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 9 }}>
            <button onClick={() => setNovaEmp(false)} style={btnSec}>Cancelar</button>
            <button onClick={criarEmpresa} disabled={criando || !en.trim()} style={{ ...btnLaranja, opacity: criando || !en.trim() ? 0.55 : 1 }}>
              {criando ? <Loader2 size={15} className="spin" /> : <Save size={15} />} Criar
            </button>
          </div>
        </div>
      )}

      <div style={{ display: "grid", gap: 10 }}>
        {empresas.map((e: Empresa) => (
          <EmpresaCard key={e.id} empresa={e}
            unidades={unidades.filter((u: Unidade) => u.empresa_id === e.id)}
            aberta={aberta === e.id} onToggleAberta={() => setAberta(aberta === e.id ? null : e.id)}
            onToggleEmpresa={() => toggleEmpresa(e)}
            onAbrirPainel={() => onAbrirPainel(e)}
            onChanged={onChanged}
          />
        ))}
      </div>

      <div style={{ marginTop: 16, background: ROXO_TINT, border: `1px solid ${BORDA}`, borderRadius: 12, padding: 14, fontSize: 12.5, color: ROXO_DARK, display: "flex", gap: 10 }}>
        <ShieldCheck size={18} color={ROXO} style={{ flexShrink: 0, marginTop: 2 }} />
        <div>O isolamento entre empresas, o cálculo do match e as regras de LGPD continuam ativos. Você pode abrir o painel de qualquer empresa e voltar aqui a qualquer momento.</div>
      </div>
    </>
  );
}

function EmpresaCard({ empresa, unidades, aberta, onToggleAberta, onToggleEmpresa, onAbrirPainel, onChanged }: any) {
  const [novoNome, setNovoNome] = useState(""); const [novaCidade, setNovaCidade] = useState("");
  const [criando, setCriando] = useState(false);
  const matriz = unidades.find((u: Unidade) => u.tipo === "matriz");
  const filiais = unidades.filter((u: Unidade) => u.tipo === "filial");

  async function addFilial() {
    if (!novoNome.trim() || criando) return;
    setCriando(true);
    const { error } = await supabase.from("unidades").insert({
      empresa_id: empresa.id, nome: novoNome.trim(), cidade: novaCidade.trim() || null, tipo: "filial",
    });
    setCriando(false);
    if (error) { alert(error.message); return; }
    setNovoNome(""); setNovaCidade(""); onChanged();
  }

  return (
    <div style={{ background: "#fff", border: `1px solid ${empresa.ativo ? BORDA : VERMELHO + "55"}`, borderRadius: 14, overflow: "hidden", opacity: empresa.ativo ? 1 : 0.75 }}>
      <button onClick={onToggleAberta} style={{ width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "15px 18px", background: "none", border: "none", cursor: "pointer", fontFamily: "inherit", textAlign: "left" }}>
        <div style={{ width: 42, height: 42, borderRadius: 11, background: ROXO_TINT, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Building2 size={20} color={ROXO} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="h" style={{ fontWeight: 800, fontSize: 16, color: ROXO_DARK }}>{empresa.nome}</div>
          <div style={{ fontSize: 12, color: "#9b93b0" }}>{empresa.cnpj || "sem CNPJ"} · {unidades.length} unidade(s)</div>
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, color: empresa.ativo ? VERDE : VERMELHO, background: (empresa.ativo ? VERDE : VERMELHO) + "18", padding: "3px 10px", borderRadius: 99, flexShrink: 0 }}>{empresa.ativo ? "Ativa" : "Inativa"}</span>
        {aberta ? <ChevronDown size={20} color="#9b93b0" /> : <ChevronRight size={20} color="#9b93b0" />}
      </button>

      {aberta && (
        <div style={{ padding: "0 18px 18px", borderTop: `1px solid ${BORDA}` }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 14 }}>
            {matriz && <UnidadeRow u={matriz} />}
            {filiais.map((f: Unidade) => <UnidadeRow key={f.id} u={f} />)}
            {unidades.length === 0 && <div style={{ fontSize: 12, color: "#9b93b0" }}>Sem unidades.</div>}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <input style={{ ...inp, flex: "1 1 160px" }} placeholder="Nome da filial" value={novoNome} onChange={(e) => setNovoNome(e.target.value)} />
            <input style={{ ...inp, flex: "1 1 120px" }} placeholder="Cidade" value={novaCidade} onChange={(e) => setNovaCidade(e.target.value)} />
            <button onClick={addFilial} disabled={criando || !novoNome.trim()} style={{ ...btnRoxo, flexShrink: 0, opacity: criando || !novoNome.trim() ? 0.55 : 1 }}>
              {criando ? <Loader2 size={14} className="spin" /> : <Plus size={15} />} Filial
            </button>
          </div>
          <div style={{ fontSize: 11, color: "#9b93b0", marginTop: 8, display: "flex", alignItems: "center", gap: 6 }}>
            <Layers size={12} /> A matriz vincula todas as filiais desta empresa.
          </div>
          <div style={{ borderTop: `1px solid ${BORDA}`, marginTop: 14, paddingTop: 12, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11.5, color: CINZA, flex: "1 1 220px" }}>
              {empresa.ativo
                ? "Inativar suspende os links públicos das vagas e o acesso de todos os usuários desta empresa."
                : "Empresa inativa — links e acessos suspensos."}
            </span>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={onAbrirPainel} style={btnRoxo}><ArrowRight size={14} /> Abrir painel</button>
              <button onClick={onToggleEmpresa} style={empresa.ativo ? btnEnc : btnRoxo}>
                <Power size={14} /> {empresa.ativo ? "Inativar empresa" : "Reativar empresa"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UnidadeRow({ u }: { u: Unidade }) {
  const ehMatriz = u.tipo === "matriz";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 11, padding: "10px 13px", border: `1px solid ${BORDA}`, borderRadius: 11, background: ehMatriz ? ROXO_TINT : "#fff" }}>
      <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", background: ehMatriz ? ROXO : "#9b93b0", padding: "3px 9px", borderRadius: 99, flexShrink: 0 }}>{ehMatriz ? "MATRIZ" : "FILIAL"}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: ROXO_DARK }}>{u.nome}</div>
        {u.cidade && <div style={{ fontSize: 11.5, color: "#9b93b0", display: "flex", alignItems: "center", gap: 4 }}><MapPin size={11} /> {u.cidade}</div>}
      </div>
    </div>
  );
}

/* ====================== AUX ====================== */
const inp: React.CSSProperties = { width: "100%", padding: "10px 12px", border: `1.5px solid ${BORDA}`, borderRadius: 10, fontSize: 13.5, fontFamily: "inherit", color: ROXO_DARK, background: "#fff", boxSizing: "border-box" };
const btnLaranja: React.CSSProperties = { background: LARANJA, color: "#fff", border: "none", padding: "10px 16px", borderRadius: 11, fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 7, fontFamily: "inherit" };
const btnRoxo: React.CSSProperties = { background: ROXO, color: "#fff", border: "none", padding: "10px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" };
const btnSec: React.CSSProperties = { background: "#fff", color: ROXO, border: `1.5px solid ${BORDA}`, padding: "10px 16px", borderRadius: 10, fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };
const btnEnc: React.CSSProperties = { background: "#fff", color: VERMELHO, border: `1.5px solid ${VERMELHO}44`, padding: "9px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit", flexShrink: 0 };
const iconBtn: React.CSSProperties = { background: "none", border: `1px solid ${BORDA}`, borderRadius: 9, width: 34, height: 34, cursor: "pointer", color: CINZA, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block", marginBottom: 14 }}>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: ROXO_DARK, marginBottom: 6, display: "block" }}>{label}</span>
      {children}
    </label>
  );
}

function Switch({ on, onClick, disabled }: { on: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={disabled ? undefined : onClick} aria-pressed={on} style={{
      width: 40, height: 23, borderRadius: 99, border: "none", flexShrink: 0, position: "relative",
      background: on ? VERDE : "#CBD5E1", cursor: disabled ? "not-allowed" : "pointer", opacity: disabled ? 0.55 : 1, transition: "background .15s",
    }}>
      <span style={{ position: "absolute", top: 3, left: on ? 20 : 3, width: 17, height: 17, borderRadius: 99, background: "#fff", transition: "left .15s", boxShadow: "0 1px 3px rgba(0,0,0,.3)" }} />
    </button>
  );
}
