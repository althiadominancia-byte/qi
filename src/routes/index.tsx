import { createFileRoute, redirect } from "@tanstack/react-router";
import { destinoPorIdentidade } from "@/lib/rotear-identidade";
import { ROXO, CINZA } from "@/lib/recrutamento/data";

// Primeira tela = login. Sem sessão → /auth. Com sessão, roteia por identidade:
// staff (usuarios) → /super ou /admin; candidato (candidato_contas) → /portal.
export const Route = createFileRoute("/")({
  ssr: false,
  beforeLoad: async () => {
    const destino = await destinoPorIdentidade();
    // "/portal" ainda não está no routeTree gerado — cast até a rota existir.
    throw redirect({ to: destino as any });
  },
  component: RedirecionandoPage,
});

function RedirecionandoPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui",
        color: CINZA,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span
          style={{
            width: 16,
            height: 16,
            borderRadius: 99,
            border: `2px solid ${ROXO}`,
            borderTopColor: "transparent",
            display: "inline-block",
            animation: "spin 1s linear infinite",
          }}
        />
        Redirecionando...
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    </div>
  );
}
