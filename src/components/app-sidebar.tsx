import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Briefcase,
  FolderPlus,
  FolderTree,
  Users,
  ShieldCheck,
  Building2,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getMyScope } from "@/lib/scope.functions";
import { MarcaEstrela } from "@/components/MarcaEstrela";
import { ROXO, ROXO_DARK } from "@/lib/recrutamento/data";

type LeafTo = "/admin" | "/catalogo" | "/lideres" | "/permissoes" | "/super";
type NavLeaf = {
  kind: "leaf";
  to: LeafTo;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  superOnly?: boolean;
};
type NavGroup = {
  kind: "group";
  id: string;
  label: string;
  icon: React.ComponentType<{ size?: number }>;
  children: { to: LeafTo; label: string; icon: React.ComponentType<{ size?: number }> }[];
};
type NavItem = NavLeaf | NavGroup;

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
    ],
  },
  { kind: "leaf", to: "/permissoes", label: "Permissões", icon: ShieldCheck },
  { kind: "leaf", to: "/super", label: "Empresas", icon: Building2, superOnly: true },
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
        background: ROXO_DARK,
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        transition: "width .2s ease",
        position: "sticky",
        top: 0,
        height: "100vh",
        zIndex: 30,
      }}
    >
      {/* Topo / logo */}
      <div
        style={{
          padding: collapsed ? "14px 0" : "14px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "flex-start",
          gap: 10,
          borderBottom: "1px solid rgba(255,255,255,.08)",
          minHeight: 60,
        }}
      >
        <MarcaEstrela size={28} branca />
        {!collapsed && (
          <div style={{ lineHeight: 1.1 }}>
            <div style={{ fontWeight: 800, fontSize: 14 }}>Estrela</div>
            <div style={{ fontSize: 11, opacity: 0.75 }}>Recrutamento</div>
          </div>
        )}
      </div>

      {/* Toggle */}
      <button
        onClick={onToggle}
        title={collapsed ? "Expandir" : "Recolher"}
        style={{
          position: "absolute",
          top: 22,
          right: -12,
          width: 24,
          height: 24,
          borderRadius: 999,
          background: "#fff",
          color: ROXO_DARK,
          border: `1px solid ${ROXO_DARK}`,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 2px 6px rgba(0,0,0,.15)",
          zIndex: 31,
        }}
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      {/* Nav */}
      <nav style={{ flex: 1, padding: "10px 8px", display: "grid", gap: 2, alignContent: "start" }}>
        {NAV.filter((i) => !i.superOnly || isSuper).map((item) => {
          const active = isActive(item.to);
          const Icon = item.icon;
          const needsEmpresa = item.to !== "/super";
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
                color: "#fff",
                textDecoration: "none",
                background: active ? ROXO : "transparent",
                fontSize: 13,
                fontWeight: active ? 700 : 500,
              }}
            >
              <Icon size={18} />
              {!collapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Rodapé / usuário */}
      <div
        style={{
          borderTop: "1px solid rgba(255,255,255,.08)",
          padding: collapsed ? "10px 0" : "10px 12px",
          display: "grid",
          gap: 8,
        }}
      >
        {!collapsed && scope && (
          <div style={{ fontSize: 11, opacity: 0.8, lineHeight: 1.3 }}>
            <div style={{ fontWeight: 700, color: "#fff", fontSize: 12 }}>
              {scope.nome || scope.email}
            </div>
            {scope.empresa_nome && <div>{scope.empresa_nome}</div>}
            <div style={{ opacity: 0.7 }}>{labelRole(scope.role)}</div>
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
            background: "rgba(255,255,255,.08)",
            color: "#fff",
            border: "none",
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

function labelRole(r: string) {
  switch (r) {
    case "super_admin": return "Super Admin";
    case "admin_empresa": return "Admin da empresa";
    case "recrutador": return "Recrutador";
    case "visualizador": return "Visualizador";
    default: return r;
  }
}
