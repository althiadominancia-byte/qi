import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { ROXO, CINZA } from "@/lib/recrutamento/data";

// Primeira tela = login. Sem sessão → /auth. Com sessão, roteia por papel:
// super_admin → /super (gestão, com impersonação por empresa); demais → /admin.
export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    const { data: u } = await supabase
      .from("usuarios").select("role").eq("id", data.user.id).maybeSingle();
    throw redirect({ to: u?.role === "super_admin" ? "/super" : "/admin" });
  },
  component: RedirecionandoPage,
});

function RedirecionandoPage() {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui", color: CINZA }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 16, height: 16, borderRadius: 99, border: `2px solid ${ROXO}`, borderTopColor: "transparent", display: "inline-block", animation: "spin 1s linear infinite" }} />
        Redirecionando...
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );
}
