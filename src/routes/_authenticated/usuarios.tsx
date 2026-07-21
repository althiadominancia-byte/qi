import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Users, Plus, X, Save, Loader2, Pencil, Power, ShieldCheck,
  UserCog, UserSearch, Eye,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getMyScope } from "@/lib/scope.functions";
import { createUserInvite, updateUser, toggleUserAtivo } from "@/lib/admin-users.functions";
import { ROLES, ROLES_EDITAVEIS, PRESET, type RoleKey } from "@/lib/recrutamento/perms";
import { ROXO, ROXO_DARK, ROXO_TINT, LARANJA, CINZA, BORDA, VERDE, VERMELHO } from "@/lib/recrutamento/data";

type UsuariosSearch = { empresa?: string };

export const Route = createFileRoute("/_authenticated/usuarios")({
  head: () => ({ meta: [{ title: "Usuários da empresa" }] }),
  validateSearch: (s: Record<string, unknown>): UsuariosSearch => ({
    empresa: typeof s.empresa === "string" ? s.empresa : undefined,
  }),
  component: UsuariosEmpresaPage,
});

const ROLE_ICONS: Record<string, any> = {
  admin_empresa: UserCog, recrutador: UserSearch, visualizador: Eye,
};

type Unidade = { id: string; empresa_id: string; nome: string; tipo: "matriz" | "filial"; cidade: string | null };
type Usuario = {
  id: string; nome: string; email: string; role: RoleKey;
  empresa_id: string | null; todas_unidades: boolean; perms: Record<string, boolean>; ativo: boolean;
};
type UsuarioEdit = Usuario & { unidades: string[]; _novo?: boolean };

function UsuariosEmpresaPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const search = Route.useSearch();
  const fetchScope = useServerFn(getMyScope);
  const scopeQ = useQuery({ queryKey: ["my-scope"], queryFn: () => fetchScope() });
  const scope = scopeQ.data;
  const isSuper = scope?.role === "super_admin";

  // Só quem pode gerenciar usuários da empresa. Empresa ativa: super via
  // impersonação (?empresa=), admin_empresa é a própria.
  const pode = isSuper || !!scope?.perms?.gerenciar_usuarios;
  const empresaId = isSuper ? (search.empresa ?? null) : (scope?.empresa_id ?? null);

  useEffect(() => {
    if (scopeQ.isSuccess && scope && !pode) navigate({ to: "/admin", replace: true });
  }, [scopeQ.isSuccess, scope, pode, navigate]);

  const [editUser, setEditUser] = useState<UsuarioEdit | null>(null);

  const empresaQ = useQuery({
    queryKey: ["usuarios-empresa:nome", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data } = await supabase.from("empresas").select("nome").eq("id", empresaId!).maybeSingle();
      return data?.nome ?? null;
    },
  });
  const unidadesQ = useQuery({
    queryKey: ["usuarios-empresa:unidades", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase.from("unidades").select("*").eq("empresa_id", empresaId!).order("created_at");
      if (error) throw error;
      return (data ?? []) as Unidade[];
    },
  });
  const usuariosQ = useQuery({
    queryKey: ["usuarios-empresa:lista", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("usuarios").select("*")
        .eq("empresa_id", empresaId!).neq("role", "super_admin").order("nome");
      if (error) throw error;
      return (data ?? []) as any as Usuario[];
    },
  });
  const userUnidadesQ = useQuery({
    queryKey: ["usuarios-empresa:user_unidades", empresaId, (usuariosQ.data ?? []).length],
    enabled: !!empresaId && (usuariosQ.data ?? []).length > 0,
    queryFn: async () => {
      const ids = (usuariosQ.data ?? []).map((u) => u.id);
      const { data, error } = await supabase.from("usuario_unidades").select("*").in("usuario_id", ids);
      if (error) throw error;
      return (data ?? []) as { usuario_id: string; unidade_id: string }[];
    },
  });

  const usuarios = usuariosQ.data ?? [];
  const unidades = unidadesQ.data ?? [];
  const userUnidades = userUnidadesQ.data ?? [];
  const unidadesUsuario = (uid: string) => userUnidades.filter((x) => x.usuario_id === uid).map((x) => x.unidade_id);

  if (scopeQ.isLoading) {
    return <div style={{ padding: 40, textAlign: "center", color: CINZA, fontFamily: "system-ui" }}>Carregando...</div>;
  }
  if (scope && !pode) return null;

  return (
    <div style={{ fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif", background: "#FBFAFE", minHeight: "100vh", color: ROXO_DARK, paddingBottom: 40 }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box} .h{font-family:'Outfit',sans-serif}
        input:focus,select:focus{outline:none;border-color:${ROXO}!important;box-shadow:0 0 0 3px ${ROXO_TINT}}
        @keyframes spin{to{transform:rotate(360deg)}} .spin{animation:spin 1s linear infinite}
      `}</style>

      <div style={{ background: ROXO, padding: "14px 18px", display: "flex", alignItems: "center", gap: 10, position: "sticky", top: 0, zIndex: 30 }}>
        <Users size={20} color="#fff" />
        <div style={{ lineHeight: 1.1, minWidth: 0 }}>
          <div className="h" style={{ color: "#fff", fontWeight: 800, fontSize: 17 }}>Usuários</div>
          <div style={{ color: "#fff", fontSize: 12, opacity: 0.85, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {empresaQ.data || scope?.empresa_nome || "Empresa"}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 860, margin: "0 auto", padding: "18px" }}>
        {!empresaId ? (
          <div style={{ background: "#fff", border: `1px dashed ${BORDA}`, borderRadius: 13, padding: 24, textAlign: "center", color: CINZA, fontSize: 13.5 }}>
            {isSuper
              ? <>Abra uma empresa (Gestão → Empresas → <strong>Abrir painel</strong>) para gerenciar os usuários dela.</>
              : <>Sua conta não está vinculada a uma empresa.</>}
          </div>
        ) : (
          <>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 8, flexWrap: "wrap" }}>
              <div style={{ fontSize: 13, color: CINZA }}>
                {usuariosQ.isLoading ? "Carregando..." : `${usuarios.length} usuário(s) · ${usuarios.filter((u) => u.ativo).length} ativo(s)`}
              </div>
              <button onClick={() => setEditUser({
                id: "", nome: "", email: "", role: "recrutador",
                empresa_id: empresaId, todas_unidades: true,
                perms: { ...PRESET.recrutador }, ativo: true, unidades: [], _novo: true,
              })} style={btnLaranja}><Plus size={16} /> Novo usuário</button>
            </div>

            <div style={{ display: "grid", gap: 9 }}>
              {usuarios.map((u) => {
                const role = ROLES[u.role]; const Ic = ROLE_ICONS[u.role] ?? UserSearch;
                const escopo = u.todas_unidades ? "todas as unidades" : `${unidadesUsuario(u.id).length} unidade(s)`;
                const iniciais = (u.nome || u.email).split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
                return (
                  <div key={u.id} style={{ background: "#fff", border: `1px solid ${BORDA}`, borderRadius: 13, padding: "13px 16px", display: "flex", alignItems: "center", gap: 13, opacity: u.ativo ? 1 : 0.55 }}>
                    <div className="h" style={{ width: 42, height: 42, borderRadius: 99, background: role.cor + "18", color: role.cor, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, flexShrink: 0 }}>{iniciais}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="h" style={{ fontWeight: 700, fontSize: 15 }}>
                        {u.nome || "(sem nome)"} {!u.ativo && <span style={{ fontSize: 11, color: VERMELHO, fontWeight: 700 }}>· inativo</span>}
                      </div>
                      <div style={{ fontSize: 12, color: "#9b93b0" }}>{u.email}</div>
                      <div style={{ fontSize: 11.5, color: CINZA, marginTop: 3 }}>{escopo}</div>
                    </div>
                    <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, color: role.cor, background: role.cor + "18", padding: "4px 10px", borderRadius: 99, flexShrink: 0 }}>
                      <Ic size={13} /> {role.nome}
                    </span>
                    <button onClick={async () => {
                      try { await toggleUserAtivo({ data: { id: u.id, ativo: !u.ativo } }); qc.invalidateQueries({ queryKey: ["usuarios-empresa:lista", empresaId] }); }
                      catch (e: any) { alert(e.message); }
                    }} title={u.ativo ? "Desativar" : "Ativar"} style={{ ...iconBtn, color: u.ativo ? VERDE : "#9b93b0" }}><Power size={16} /></button>
                    <button onClick={() => setEditUser({ ...u, unidades: unidadesUsuario(u.id) })} title="Editar" style={iconBtn}><Pencil size={15} /></button>
                  </div>
                );
              })}
              {!usuariosQ.isLoading && usuarios.length === 0 && (
                <div style={{ background: "#fff", border: `1px dashed ${BORDA}`, borderRadius: 13, padding: 24, textAlign: "center", color: CINZA, fontSize: 13 }}>
                  Nenhum usuário nesta empresa ainda.
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {editUser && empresaId && (
        <UsuarioModal
          user={editUser} unidades={unidades}
          onClose={() => setEditUser(null)}
          onSaved={() => {
            setEditUser(null);
            qc.invalidateQueries({ queryKey: ["usuarios-empresa:lista", empresaId] });
            qc.invalidateQueries({ queryKey: ["usuarios-empresa:user_unidades", empresaId] });
          }}
        />
      )}
    </div>
  );
}

function UsuarioModal({ user, unidades, onClose, onSaved }: { user: UsuarioEdit; unidades: Unidade[]; onClose: () => void; onSaved: () => void }) {
  const [u, setU] = useState<UsuarioEdit>(user);
  const [saving, setSaving] = useState(false);
  const navigate = useNavigate();
  const set = (k: keyof UsuarioEdit, v: any) => setU((p) => ({ ...p, [k]: v }));
  const toggleUnidade = (id: string) => setU((p) => ({ ...p, unidades: p.unidades.includes(id) ? p.unidades.filter((x) => x !== id) : [...p.unidades, id] }));

  const podeSalvar = u.nome.trim() && u.email.trim();
  const fnCreate = useServerFn(createUserInvite);
  const fnUpdate = useServerFn(updateUser);

  async function salvar() {
    if (!podeSalvar || saving) return;
    setSaving(true);
    try {
      const payload = {
        nome: u.nome.trim(), email: u.email.trim().toLowerCase(),
        role: u.role, empresa_id: u.empresa_id,
        todas_unidades: u.todas_unidades, unidades: u.unidades,
        // perms guarda só overrides; edição fina fica na página de Permissões.
        perms: user._novo ? {} : (u.perms ?? {}),
        ativo: u.ativo,
      };
      if (user._novo) await fnCreate({ data: payload as any });
      else await fnUpdate({ data: { id: u.id, ...payload } as any });
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
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <Campo label="Nome completo"><input style={inp} value={u.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Nome" /></Campo>
            <Campo label="E-mail (login)"><input style={inp} type="email" value={u.email} onChange={(e) => set("email", e.target.value)} placeholder="email@empresa.com" disabled={!user._novo} /></Campo>
          </div>

          <Campo label="Papel (função)">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {ROLES_EDITAVEIS.map((rk) => {
                const r = ROLES[rk]; const Ic = ROLE_ICONS[rk] ?? UserSearch; const on = u.role === rk;
                return (
                  <button key={rk} onClick={() => setU((p) => ({ ...p, role: rk, perms: {} }))} style={{
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

          <Campo label="Acesso às unidades">
            <label style={{ display: "flex", alignItems: "center", gap: 9, fontSize: 13, color: ROXO_DARK, marginBottom: 10, cursor: "pointer" }}>
              <Switch on={u.todas_unidades} onClick={() => set("todas_unidades", !u.todas_unidades)} />
              Todas as unidades da empresa (matriz + filiais)
            </label>
            {!u.todas_unidades && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
                {unidades.map((un) => {
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

          <Campo label="Permissões">
            <div style={{ border: `1px solid ${BORDA}`, borderRadius: 12, padding: 14, background: ROXO_TINT, display: "flex", gap: 11, alignItems: "flex-start" }}>
              <ShieldCheck size={18} color={ROXO} style={{ flexShrink: 0, marginTop: 1 }} />
              <div style={{ flex: 1, fontSize: 12.5, color: ROXO_DARK, lineHeight: 1.5 }}>
                As permissões seguem o <strong>padrão do papel</strong>, com ajustes individuais na página de Permissões.
                <div style={{ marginTop: 8 }}>
                  <button type="button" onClick={() => { onClose(); navigate({ to: "/permissoes", search: { empresa: u.empresa_id ?? undefined } as any }); }}
                    style={{ background: ROXO, color: "#fff", border: "none", padding: "7px 12px", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", display: "inline-flex", alignItems: "center", gap: 6 }}>
                    <ShieldCheck size={13} /> Ajustar permissões
                  </button>
                </div>
              </div>
            </div>
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

const inp: React.CSSProperties = { width: "100%", padding: "10px 12px", border: `1.5px solid ${BORDA}`, borderRadius: 10, fontSize: 13.5, fontFamily: "inherit", color: ROXO_DARK, background: "#fff", boxSizing: "border-box" };
const btnLaranja: React.CSSProperties = { background: LARANJA, color: "#fff", border: "none", padding: "10px 16px", borderRadius: 11, fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 7, fontFamily: "inherit" };
const btnSec: React.CSSProperties = { background: "#fff", color: ROXO, border: `1.5px solid ${BORDA}`, padding: "10px 16px", borderRadius: 10, fontSize: 13.5, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" };
const iconBtn: React.CSSProperties = { background: "none", border: `1px solid ${BORDA}`, borderRadius: 9, width: 34, height: 34, cursor: "pointer", color: CINZA, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 };

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "block", marginBottom: 14 }}>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: ROXO_DARK, marginBottom: 6, display: "block" }}>{label}</span>
      {children}
    </label>
  );
}

function Switch({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={on} style={{
      width: 40, height: 23, borderRadius: 99, border: "none", flexShrink: 0, position: "relative",
      background: on ? VERDE : "#CBD5E1", cursor: "pointer", transition: "background .15s",
    }}>
      <span style={{ position: "absolute", top: 3, left: on ? 20 : 3, width: 17, height: 17, borderRadius: 99, background: "#fff", transition: "left .15s", boxShadow: "0 1px 3px rgba(0,0,0,.3)" }} />
    </button>
  );
}
