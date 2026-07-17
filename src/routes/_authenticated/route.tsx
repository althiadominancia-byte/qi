import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { AppSidebar } from "@/components/app-sidebar";
import { BrandingStyle } from "@/components/BrandingStyle";
import { getMyScope } from "@/lib/scope.functions";

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
  const branding = scopeQ.data?.branding;
  return (
    <div style={{ display: "flex", minHeight: "100vh", width: "100%" }}>
      {branding && (
        <BrandingStyle
          cor_primaria={branding.cor_primaria}
          cor_sidebar={branding.cor_sidebar}
          cor_botao={branding.cor_botao}
        />
      )}
      <AppSidebar collapsed={collapsed} onToggle={toggle} />
      <main style={{ flex: 1, minWidth: 0 }}>
        <Outlet />
      </main>
    </div>
  );
}
