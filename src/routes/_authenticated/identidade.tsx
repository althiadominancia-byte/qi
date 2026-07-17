import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Palette } from "lucide-react";
import { getMyScope } from "@/lib/scope.functions";
import { BrandingEditor } from "@/components/BrandingEditor";
import { ROXO, ROXO_DARK, CINZA, BORDA } from "@/lib/recrutamento/data";

export const Route = createFileRoute("/_authenticated/identidade")({
  head: () => ({ meta: [{ title: "Identidade visual" }] }),
  component: IdentidadePage,
});

function IdentidadePage() {
  const navigate = useNavigate();
  const fetchScope = useServerFn(getMyScope);
  const scopeQ = useQuery({ queryKey: ["my-scope"], queryFn: () => fetchScope() });
  const scope = scopeQ.data;

  // Super_admin edita a marca pela aba Empresas (por empresa). Aqui é o
  // autoatendimento do admin_empresa para a própria empresa.
  const pode = scope?.role === "super_admin" || scope?.role === "admin_empresa";

  useEffect(() => {
    if (scopeQ.isSuccess && scope && !pode) navigate({ to: "/admin", replace: true });
  }, [scopeQ.isSuccess, scope, pode, navigate]);

  if (scopeQ.isLoading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: CINZA, fontFamily: "system-ui" }}>
        Carregando...
      </div>
    );
  }
  if (!scope || !pode) return null;

  if (!scope.empresa_id) {
    return (
      <div
        style={{
          fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
          minHeight: "100vh",
          background: "#FBFAFE",
        }}
      >
        <Header />
        <div
          style={{
            maxWidth: 720,
            margin: "0 auto",
            padding: "24px 18px",
            color: CINZA,
            fontSize: 14,
          }}
        >
          Super Admin não está vinculado a uma empresa. Edite a identidade de cada empresa pela aba{" "}
          <strong>Empresas</strong>.
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        fontFamily: "'Plus Jakarta Sans', system-ui, sans-serif",
        minHeight: "100vh",
        background: "#FBFAFE",
        color: ROXO_DARK,
      }}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@600;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap');
        @keyframes spin{to{transform:rotate(360deg)}} .spin{animation:spin 1s linear infinite}`}</style>
      <Header />
      <div style={{ maxWidth: 720, margin: "0 auto", padding: "22px 18px" }}>
        <p
          style={{ fontSize: 13.5, color: CINZA, marginTop: 0, marginBottom: 18, lineHeight: 1.55 }}
        >
          Personalize a logo e as cores da <strong>{scope.empresa_nome}</strong>. As alterações
          valem no painel e no formulário público das vagas.
        </p>
        <div
          style={{
            background: "#fff",
            border: `1px solid ${BORDA}`,
            borderRadius: 16,
            padding: 20,
          }}
        >
          <BrandingEditor empresaId={scope.empresa_id} />
        </div>
      </div>
    </div>
  );
}

function Header() {
  return (
    <div
      style={{
        background: ROXO,
        padding: "14px 18px",
        display: "flex",
        alignItems: "center",
        gap: 10,
        position: "sticky",
        top: 0,
        zIndex: 30,
      }}
    >
      <Palette size={20} color="#fff" />
      <div
        className="h"
        style={{ color: "#fff", fontWeight: 800, fontSize: 17, fontFamily: "'Outfit', sans-serif" }}
      >
        Identidade visual
      </div>
    </div>
  );
}
