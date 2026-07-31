import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { LogOut, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ROXO, ROXO_DARK, BORDA } from "@/lib/recrutamento/data";

export const Route = createFileRoute("/_candidato")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    // "/portal/entrar" pode ainda não estar no routeTree gerado — cast até a rota existir.
    if (error || !data.user) throw redirect({ to: "/portal/entrar" as any });
    return { user: data.user };
  },
  component: CandidatoLayout,
});

function CandidatoLayout() {
  const navigate = useNavigate();

  async function sair() {
    await supabase.auth.signOut();
    navigate({ to: "/portal/entrar" as any, replace: true });
  }

  return (
    // Coluna com min-height total: o rodapé fica sempre colado ao fim da viewport.
    <div
      style={{
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        background: "#F7F5FB",
        color: ROXO_DARK,
      }}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@500;600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        .h{font-family:'Outfit',sans-serif}
      `}</style>

      {/* Header leve: marca NEUTRA da plataforma (sem marca de tenant). */}
      <header
        style={{
          background: ROXO,
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: 10,
          position: "sticky",
          top: 0,
          zIndex: 30,
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 9,
            background: "linear-gradient(135deg, #fff 0%, rgba(255,255,255,.82) 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            boxShadow: "0 6px 18px -8px rgba(0,0,0,.35)",
          }}
        >
          <Sparkles size={16} color={ROXO} strokeWidth={2.4} />
        </div>
        <div
          className="h"
          style={{
            color: "#fff",
            fontWeight: 800,
            fontSize: 16,
            letterSpacing: 0.3,
            minWidth: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          Portal do Candidato
        </div>
        <button
          type="button"
          onClick={sair}
          style={{
            marginLeft: "auto",
            background: "rgba(255,255,255,.14)",
            border: "1px solid rgba(255,255,255,.25)",
            color: "#fff",
            padding: "7px 12px",
            borderRadius: 9,
            fontSize: 12.5,
            fontWeight: 700,
            cursor: "pointer",
            fontFamily: "inherit",
            display: "flex",
            alignItems: "center",
            gap: 6,
            minHeight: 34,
            flexShrink: 0,
          }}
        >
          <LogOut size={14} /> Sair
        </button>
      </header>

      <main style={{ flex: 1, width: "100%", minWidth: 0 }}>
        <Outlet />
      </main>

      <footer
        style={{
          padding: "13px 16px",
          textAlign: "center",
          fontSize: 11.5,
          color: "#9b93b0",
          lineHeight: 1.5,
          borderTop: `1px solid ${BORDA}`,
          background: "#fff",
        }}
      >
        Dúvidas sobre seus dados? Fale com a empresa da vaga · LGPD Lei 13.709/2018
      </footer>
    </div>
  );
}
