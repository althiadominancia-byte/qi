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
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  LayoutDashboard,
  UserRound,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getMyScope } from "@/lib/scope.functions";
import { MarcaEstrela } from "@/components/MarcaEstrela";
import { logoUrl } from "@/components/BrandingStyle";
import type { PermKey } from "@/lib/recrutamento/perms";
import { resolveFeatures, hasFeature, type FeatureKey } from "@/lib/recrutamento/features";
import { ROXO, PLATAFORMA } from "@/lib/recrutamento/data";

type LeafTo =
  | "/admin"
  | "/dashboard"
  | "/catalogo"
  | "/lideres"
  | "/niveis"
  | "/permissoes"
  | "/super"
  | "/identidade"
  | "/usuarios"
  | "/planos"
  | "/talentos";
type NavLeaf = {
  kind: "leaf";
  to: LeafTo;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  perm?: PermKey; // exige permissão efetiva de aplicação (super passa)
  soAdminEmpresa?: boolean; // exige role admin_empresa (não faz sentido p/ super)
  feature?: FeatureKey; // exige entitlement (feature liberada no plano da empresa)
  tab?: "empresas" | "usuarios"; // item do /super: deep-link da aba
};
type NavGroup = {
  kind: "group";
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  perm?: PermKey;
  children: {
    to: LeafTo;
    label: string;
    icon: React.ComponentType<{ size?: number }>;
    feature?: FeatureKey;
  }[];
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

// Plano de USO DA APLICAÇÃO (dentro de uma empresa). Itens escondidos conforme
// a permissão efetiva do usuário. super_admin impersonando vê tudo.
const NAV_APP: NavItem[] = [
  { kind: "leaf", to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { kind: "leaf", to: "/admin", label: "Vagas", icon: Briefcase },
  {
    kind: "leaf",
    to: "/talentos",
    label: "Banco de Talentos",
    icon: UserRound,
    perm: "ver_candidatos",
    feature: "banco_talentos",
  },
  {
    kind: "group",
    id: "cadastro",
    label: "Cadastro",
    icon: FolderPlus,
    perm: "gerenciar_catalogo",
    children: [
      { to: "/catalogo", label: "Departamentos e Setores", icon: FolderTree },
      { to: "/lideres", label: "Líderes", icon: Users, feature: "niveis_lideranca" },
      { to: "/niveis", label: "Níveis de Liderança", icon: Crown, feature: "niveis_lideranca" },
    ],
  },
  { kind: "leaf", to: "/usuarios", label: "Usuários", icon: Users, perm: "gerenciar_usuarios" },
  {
    kind: "leaf",
    to: "/permissoes",
    label: "Permissões",
    icon: ShieldCheck,
    perm: "gerenciar_usuarios",
  },
  {
    kind: "leaf",
    to: "/identidade",
    label: "Identidade visual",
    icon: Palette,
    soAdminEmpresa: true,
    feature: "white_label",
  },
];

// Plano de GESTÃO DO SAAS (governança da plataforma). Só super_admin, fora de
// impersonação. Deep-link nas abas do /super.
const NAV_SAAS: NavItem[] = [
  { kind: "leaf", to: "/super", label: "Empresas & unidades", icon: Building2, tab: "empresas" },
  { kind: "leaf", to: "/super", label: "Usuários", icon: Users, tab: "usuarios" },
  { kind: "leaf", to: "/planos", label: "Configuração de planos", icon: Layers },
];

export function AppSidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const fetchScope = useServerFn(getMyScope);
  const scopeQ = useQuery({ queryKey: ["my-scope"], queryFn: () => fetchScope() });
  const scope = scopeQ.data;
  const isSuper = scope?.role === "super_admin";
  const isAdminEmpresa = scope?.role === "admin_empresa";

  // ?empresa= (impersonação) e ?tab= (aba do /super), preservados entre páginas.
  const currentEmpresa = (location.search as any)?.empresa as string | undefined;
  const currentTab = (location.search as any)?.tab as string | undefined;
  const empresaParam = currentEmpresa || (scope?.empresa_id ?? undefined);

  // Dois planos: super_admin sem empresa ativa = GESTÃO DO SAAS (shell neutro);
  // super_admin impersonando OU qualquer papel de empresa = USO DA APLICAÇÃO.
  const impersonando = !!isSuper && !!currentEmpresa;
  const contexto: "saas" | "app" = isSuper && !impersonando ? "saas" : "app";
  const neutro = contexto === "saas";
  const T = neutro ? TEMA_PLATAFORMA : TEMA_TENANT;
  const nav = contexto === "saas" ? NAV_SAAS : NAV_APP;

  const customLogo = logoUrl(scope?.branding?.logo_path);

  // Nome da empresa impersonada (faixa de gestão + header no plano de aplicação).
  const empresaImpQ = useQuery({
    queryKey: ["sidebar-empresa", currentEmpresa],
    enabled: impersonando,
    queryFn: async () => {
      const { data } = await supabase
        .from("empresas")
        .select("nome")
        .eq("id", currentEmpresa!)
        .maybeSingle();
      return data?.nome ?? null;
    },
  });
  const marcaNome = neutro
    ? "Plataforma"
    : impersonando
      ? empresaImpQ.data || "Empresa"
      : scope?.empresa_nome || "Estrela";

  // Entitlements efetivos da empresa ativa: super impersonando busca da empresa
  // aberta (RPC); demais papéis herdam do scope. Enquanto carrega => permissivo.
  const featuresImpQ = useQuery({
    queryKey: ["sidebar-features", currentEmpresa],
    enabled: impersonando,
    queryFn: async () => {
      const { data } = await supabase.rpc("get_empresa_features" as any, {
        p_empresa_id: currentEmpresa!,
      });
      return resolveFeatures((data ?? null) as any, null);
    },
  });
  const features: Record<string, boolean> | null = impersonando
    ? (featuresImpQ.data ?? null)
    : (scope?.features ?? null);

  // Gating de item. A FEATURE (entitlement da empresa) aplica a todos, inclusive
  // super impersonando. A PERMISSÃO de usuário é que o super ignora.
  const podeVer = (item: NavItem): boolean => {
    if (contexto === "saas") return true;
    if (item.kind === "leaf" && item.feature && !hasFeature(features, item.feature)) return false;
    // Itens exclusivos do admin_empresa (ex.: /identidade, autoatendimento da
    // própria marca) NÃO aparecem para o super — ele edita a marca de cada
    // empresa pelo card em /super. Checado ANTES do atalho de super, senão o
    // super clicaria e cairia em /identidade sem empresa própria (bounce).
    if (item.kind === "leaf" && item.soAdminEmpresa) return isAdminEmpresa;
    if (isSuper) return true;
    if (item.perm) return !!scope?.perms?.[item.perm];
    return true;
  };

  const isActive = (to: string) => location.pathname.startsWith(to);

  async function sair() {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  }

  function voltarGestao() {
    try {
      sessionStorage.removeItem("empresa_ativa_id");
    } catch {}
    navigate({ to: "/super", search: { tab: "empresas" } as any });
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
        // Clipa o conteúdo enquanto a largura anima (expandir/recolher), senão os
        // rótulos do menu transbordam para fora da sidebar. Scroll vertical se o
        // menu ficar alto.
        overflowX: "hidden",
        overflowY: "auto",
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
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: PLATAFORMA.primary,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Layers size={16} color="#fff" />
              </div>
            ) : (
              <MarcaEstrela size={28} branca src={customLogo} alt={marcaNome} />
            )}
            <div style={{ lineHeight: 1.1, minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 800,
                  fontSize: 14,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {marcaNome}
              </div>
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

      {/* Faixa de gestão — super_admin impersonando uma empresa */}
      {impersonando &&
        (collapsed ? (
          <button
            onClick={voltarGestao}
            title={`Gerenciando ${marcaNome} — voltar à gestão`}
            style={{
              margin: "8px auto 0",
              width: 40,
              height: 40,
              borderRadius: 10,
              background: T.btnBg,
              color: T.text,
              border: `1px solid ${T.btnBorder}`,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ArrowLeft size={16} />
          </button>
        ) : (
          <div
            style={{
              margin: "8px 8px 0",
              padding: "9px 11px",
              borderRadius: 10,
              background: T.hover,
              border: `1px solid ${T.border}`,
            }}
          >
            <div
              style={{
                fontSize: 9.5,
                letterSpacing: 1.2,
                textTransform: "uppercase",
                color: T.muted,
                fontWeight: 700,
              }}
            >
              Gerenciando
            </div>
            <div
              style={{
                fontSize: 13,
                fontWeight: 700,
                color: T.text,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {marcaNome}
            </div>
            <button
              onClick={voltarGestao}
              style={{
                marginTop: 7,
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                background: T.btnBg,
                color: T.text,
                border: `1px solid ${T.btnBorder}`,
                borderRadius: 8,
                padding: "6px 8px",
                fontSize: 11.5,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              <ArrowLeft size={13} /> Voltar à gestão
            </button>
          </div>
        ))}

      {/* Nav */}
      <nav
        style={{
          flex: 1,
          padding: "10px 8px",
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr)",
          gap: 2,
          alignContent: "start",
        }}
      >
        {nav.map((item) => {
          if (!podeVer(item)) return null;
          if (item.kind === "leaf") {
            const Icon = item.icon;
            let search: any = undefined;
            let active = isActive(item.to);
            if (item.tab) {
              // item do plano SaaS: aba do /super
              search = { tab: item.tab };
              active =
                location.pathname.startsWith("/super") && (currentTab ?? "empresas") === item.tab;
            } else {
              const needsEmpresa = item.to !== "/super" && item.to !== "/identidade";
              search = needsEmpresa && empresaParam ? { empresa: empresaParam } : undefined;
            }
            return (
              <Link
                key={item.label}
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
                  minWidth: 0,
                  overflow: "hidden",
                }}
              >
                <Icon size={18} />
                {!collapsed && (
                  <span
                    style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
                  >
                    {item.label}
                  </span>
                )}
              </Link>
            );
          }
          // group — filtra filhos por entitlement; some se esvaziar
          const filhos = item.children.filter((c) => !c.feature || hasFeature(features, c.feature));
          if (filhos.length === 0) return null;
          return (
            <NavGroupItem
              key={item.id}
              group={{ ...item, children: filhos }}
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
  useEffect(() => {
    if (childActive) setOpen(true);
  }, [childActive]);

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
          style={{
            transition: "transform .15s",
            transform: open ? "rotate(0deg)" : "rotate(-90deg)",
          }}
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
    case "super_admin":
      return "Super Admin";
    case "admin_empresa":
      return "Admin da empresa";
    case "recrutador":
      return "Recrutador";
    case "visualizador":
      return "Visualizador";
    default:
      return r;
  }
}
