import { createFileRoute, Outlet, redirect, useLocation } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { AppSidebar } from "@/components/app-sidebar";
import { BrandingStyle } from "@/components/BrandingStyle";
import { getMyScope } from "@/lib/scope.functions";
import { PLATAFORMA } from "@/lib/recrutamento/data";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthLayout,
});

function AuthLayout() {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("sidebar-collapsed") === "1";
  });
  const toggle = () => {
    setCollapsed((c) => {
      const n = !c;
      try { localStorage.setItem("sidebar-collapsed", n ? "1" : "0"); } catch {}
      return n;
    });
  };
  // Compartilha o cache ["my-scope"] com a sidebar — sem request extra.
  const fetchScope = useServerFn(getMyScope);
  const scopeQ = useQuery({ queryKey: ["my-scope"], queryFn: () => fetchScope() });
  const scope = scopeQ.data;
  const isSuper = scope?.role === "super_admin";

  // Empresa cujo painel está aberto: super_admin escolhe via ?empresa=; os demais
  // são fixados na própria empresa.
  const location = useLocation();
  const empresaParam = (location.search as any)?.empresa as string | undefined;
  const activeEmpresaId = isSuper ? (empresaParam ?? null) : (scope?.empresa_id ?? null);

  // Para o super_admin abrir o painel de OUTRA empresa, busca a marca dela via RPC
  // pública (o scope só traz a marca da própria empresa, que o super não tem).
  const tenantBrandingQ = useQuery({
    queryKey: ["active-branding", activeEmpresaId],
    enabled: isSuper && !!activeEmpresaId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_empresa_branding" as any, { p_empresa_id: activeEmpresaId });
      if (error) throw error;
      const row: any = Array.isArray(data) ? data[0] : data;
      return (row ?? null) as { cor_primaria: string | null; cor_sidebar: string | null; cor_botao: string | null } | null;
    },
  });

  // Cores a aplicar no shell (conteúdo do painel):
  //  - super_admin com painel de tenant aberto → marca daquele tenant;
  //  - super_admin sem tenant (ex.: /super) → paleta NEUTRA da plataforma;
  //  - demais papéis → marca da própria empresa (do scope).
  let branding: { cor_primaria: string | null; cor_sidebar: string | null; cor_botao: string | null } | null = null;
  if (isSuper) {
    branding = activeEmpresaId
      ? tenantBrandingQ.data ?? null
      : { cor_primaria: PLATAFORMA.primary, cor_sidebar: PLATAFORMA.primary, cor_botao: PLATAFORMA.primary };
  } else {
    branding = scope?.branding ?? null;
  }

  return (
    // Altura fixa da viewport + overflow oculto: a PÁGINA não rola; só o <main>
    // rola internamente. Assim o sidebar fica parado ao girar o scroll.
    <div style={{ display: "flex", height: "100vh", width: "100%", overflow: "hidden" }}>
      {branding && (
        <BrandingStyle
          cor_primaria={branding.cor_primaria}
          cor_sidebar={branding.cor_sidebar}
          cor_botao={branding.cor_botao}
        />
      )}
      <AppSidebar collapsed={collapsed} onToggle={toggle} />
      <main style={{ flex: 1, minWidth: 0, height: "100vh", overflowY: "auto" }}>
        <Outlet />
      </main>
    </div>
  );
}
