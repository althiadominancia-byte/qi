import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Briefcase,
  FolderPlus,
  FolderTree,
  Crown,
  Users,
  ShieldCheck,
  Building2,
  Palette,
  Layers,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getMyScope } from "@/lib/scope.functions";
import { MarcaEstrela } from "@/components/MarcaEstrela";
import { logoUrl } from "@/components/BrandingStyle";
import { ROXO, PLATAFORMA } from "@/lib/recrutamento/data";

type LeafTo = "/admin" | "/catalogo" | "/lideres" | "/niveis" | "/permissoes" | "/super" | "/identidade";
type NavLeaf = {
  kind: "leaf";
  to: LeafTo;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  // "super" => só super_admin; "admin" => super_admin ou admin_empresa.
  visible?: "super" | "admin";
};
type NavGroup = {
  kind: "group";
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  children: { to: LeafTo; label: string; icon: React.ComponentType<{ size?: number }> }[];
};
type NavItem = NavLeaf | NavGroup;

// Tema do shell da sidebar: claro/neutro para a plataforma (super admin, sem
// tenant) e escuro com a marca do tenant para os demais.
type SidebarTheme = {
  bg: string;
  text: string;
  muted: string;
  active: string;
  activeText: string;
  border: string;
  hover: string;
  btnBg: string;
  btnBorder: string;
};

const TEMA_TENANT: SidebarTheme = {
  bg: "var(--brand-sidebar, var(--brand-primary-dark, #3A2566))",
  text: "#fff",
  muted: "rgba(255,255,255,.75)",
  active: ROXO,
  activeText: "#fff",
  border: "rgba(255,255,255,.08)",
  hover: "rgba(255,255,255,.06)",
  btnBg: "rgba(255,255,255,.10)",
  btnBorder: "rgba(255,255,255,.18)",
};
const TEMA_PLATAFORMA: SidebarTheme = {
  bg: PLATAFORMA.sidebarBg,
  text: PLATAFORMA.sidebarText,
  muted: PLATAFORMA.sidebarMuted,
  active: PLATAFORMA.sidebarActive,
  activeText: PLATAFORMA.sidebarText,
  border: PLATAFORMA.sidebarBorder,
  hover: "rgba(15,23,42,.05)",
  btnBg: "rgba(15,23,42,.06)",
  btnBorder: "rgba(15,23,42,.14)",
};

const NAV: NavItem[] = [
  { kind: "leaf", to: "/admin", label: "Vagas", icon: Briefcase },
  {
    kind: "group",
    id: "cadastro",
    label: "Cadastro",
    icon: FolderPlus,
    children: [
      { to: "/catalogo", label: "Departamentos e Setores", icon: FolderTree },
      { to: "/lideres", label: "Líderes", icon: Users },
      { to: "/niveis", label: "Níveis de Liderança", icon: Crown },
    ],
  },
  { kind: "leaf", to: "/permissoes", label: "Permissões", icon: ShieldCheck },
  { kind: "leaf", to: "/identidade", label: "Identidade visual", icon: Palette, visible: "admin" },
  { kind: "leaf", to: "/super", label: "Empresas", icon: Building2, visible: "super" },
];

export function AppSidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const fetchScope = useServerFn(getMyScope);
  const scopeQ = useQuery({ queryKey: ["my-scope"], queryFn: () => fetchScope() });
  const scope = scopeQ.data;
  const isSuper = scope?.role === "super_admin";
  const isAdminEmpresa = scope?.role === "admin_empresa";

  // Super admin = plataforma (SaaS): shell neutro, sem marca de tenant.
  const neutro = isSuper;
  const T = neutro ? TEMA_PLATAFORMA : TEMA_TENANT;
  const customLogo = logoUrl(scope?.branding?.logo_path);
  const marcaNome = neutro ? "Plataforma" : (scope?.empresa_nome || "Estrela");

  // Preserva ?empresa= entre páginas
  const currentEmpresa = (location.search as any)?.empresa as string | undefined;
  const empresaParam = currentEmpresa || (scope?.empresa_id ?? undefined);

  const isActive = (to: string) => location.pathname.startsWith(to);

  async function sair() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  const W_OPEN = 220;
  const W_CLOSED = 64;
  const width = collapsed ? W_CLOSED : W_OPEN;

  return (
    <aside
      style={{
        width,
        minWidth: width,
        background: T.bg,
        color: T.text,
        display: "flex",
        flexDirection: "column",
        transition: "width .2s ease",
        position: "sticky",
        top: 0,
        height: "100vh",
        zIndex: 30,
        borderRight: neutro ? `1px solid ${T.border}` : undefined,
      }}
    >
      {/* Topo / logo + toggle */}
      <div
        style={{
          padding: collapsed ? "14px 8px" : "14px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "space-between",
          gap: 8,
          borderBottom: `1px solid ${T.border}`,
          minHeight: 60,
        }}
      >
        {!collapsed && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            {neutro ? (
              <div style={{ width: 28, height: 28, borderRadius: 8, background: PLATAFORMA.primary, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Layers size={16} color="#fff" />
              </div>
            ) : (
              <MarcaEstrela size={28} branca src={customLogo} alt={marcaNome} />
            )}
            <div style={{ lineHeight: 1.1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{marcaNome}</div>
              <div style={{ fontSize: 11, color: T.muted }}>Recrutamento</div>
            </div>
          </div>
        )}
        <button
          onClick={onToggle}
          title={collapsed ? "Expandir" : "Recolher"}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: T.btnBg,
            color: T.text,
            border: `1px solid ${T.btnBorder}`,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>



      {/* Nav */}
      <nav style={{ flex: 1, padding: "10px 8px", display: "grid", gap: 2, alignContent: "start" }}>
        {NAV.map((item) => {
          if (item.kind === "leaf") {
            if (item.visible === "super" && !isSuper) return null;
            if (item.visible === "admin" && !isSuper && !isAdminEmpresa) return null;
            const active = isActive(item.to);
            const Icon = item.icon;
            const needsEmpresa = item.to !== "/super" && item.to !== "/identidade";
            const search = needsEmpresa && empresaParam ? { empresa: empresaParam } : undefined;
            return (
              <Link
                key={item.to}
                to={item.to}
                search={search as any}
                title={collapsed ? item.label : undefined}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: collapsed ? "10px 0" : "10px 12px",
                  justifyContent: collapsed ? "center" : "flex-start",
                  borderRadius: 8,
                  color: active ? T.activeText : T.text,
                  textDecoration: "none",
                  background: active ? T.active : "transparent",
                  fontSize: 13,
                  fontWeight: active ? 700 : 500,
                }}
              >
                <Icon size={18} />
                {!collapsed && <span>{item.label}</span>}
              </Link>
            );
          }
          // group
          return (
            <NavGroupItem
              key={item.id}
              group={item}
              collapsed={collapsed}
              empresaParam={empresaParam}
              isActivePath={isActive}
              theme={T}
            />
          );
        })}
      </nav>

      {/* Rodapé / usuário */}
      <div
        style={{
          borderTop: `1px solid ${T.border}`,
          padding: collapsed ? "10px 0" : "10px 12px",
          display: "grid",
          gap: 8,
        }}
      >
        {!collapsed && scope && (
          <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.3 }}>
            <div style={{ fontWeight: 700, color: T.text, fontSize: 12 }}>
              {scope.nome || scope.email}
            </div>
            {!neutro && scope.empresa_nome && <div>{scope.empresa_nome}</div>}
            <div style={{ color: T.muted }}>{labelRole(scope.role)}</div>
          </div>
        )}
        <button
          onClick={sair}
          title="Sair"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: collapsed ? "center" : "flex-start",
            gap: 8,
            background: T.btnBg,
            color: T.text,
            border: `1px solid ${T.btnBorder}`,
            padding: collapsed ? "10px 0" : "8px 10px",
            borderRadius: 8,
            cursor: "pointer",
            fontSize: 12.5,
            fontWeight: 600,
          }}
        >
          <LogOut size={14} />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </aside>
  );
}

function NavGroupItem({
  group,
  collapsed,
  empresaParam,
  isActivePath,
  theme,
}: {
  group: NavGroup;
  collapsed: boolean;
  empresaParam: string | undefined;
  isActivePath: (to: string) => boolean;
  theme: SidebarTheme;
}) {
  const childActive = group.children.some((c) => isActivePath(c.to));
  const [open, setOpen] = useState(childActive);
  useEffect(() => { if (childActive) setOpen(true); }, [childActive]);

  const Icon = group.icon;
  const T = theme;
  const search = empresaParam ? { empresa: empresaParam } : undefined;

  if (collapsed) {
    // No modo recolhido, mostra os filhos diretamente como ícones
    return (
      <>
        {group.children.map((c) => {
          const active = isActivePath(c.to);
          const CIcon = c.icon;
          return (
            <Link
              key={c.to}
              to={c.to}
              search={search as any}
              title={c.label}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "10px 0",
                borderRadius: 8,
                color: active ? T.activeText : T.text,
                textDecoration: "none",
                background: active ? T.active : "transparent",
              }}
            >
              <CIcon size={18} />
            </Link>
          );
        })}
      </>
    );
  }

  return (
    <div style={{ display: "grid", gap: 2 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 12px",
          borderRadius: 8,
          background: childActive ? T.hover : "transparent",
          border: "none",
          color: T.text,
          cursor: "pointer",
          fontSize: 13,
          fontWeight: childActive ? 700 : 500,
          textAlign: "left",
          fontFamily: "inherit",
        }}
      >
        <Icon size={18} />
        <span style={{ flex: 1 }}>{group.label}</span>
        <ChevronDown
          size={14}
          style={{ transition: "transform .15s", transform: open ? "rotate(0deg)" : "rotate(-90deg)" }}
        />
      </button>
      {open && (
        <div style={{ display: "grid", gap: 2, paddingLeft: 10 }}>
          {group.children.map((c) => {
            const active = isActivePath(c.to);
            const CIcon = c.icon;
            return (
              <Link
                key={c.to}
                to={c.to}
                search={search as any}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 10px 8px 14px",
                  borderRadius: 8,
                  color: active ? T.activeText : T.text,
                  textDecoration: "none",
                  background: active ? T.active : "transparent",
                  fontSize: 12.5,
                  fontWeight: active ? 700 : 500,
                  borderLeft: `2px solid ${T.border}`,
                }}
              >
                <CIcon size={14} />
                <span>{c.label}</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}


function labelRole(r: string) {
  switch (r) {
    case "super_admin": return "Super Admin";
    case "admin_empresa": return "Admin da empresa";
    case "recrutador": return "Recrutador";
    case "visualizador": return "Visualizador";
    default: return r;
  }
}
