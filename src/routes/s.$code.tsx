import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/s/$code")({
  head: () => ({ meta: [{ title: "Redirecionando…" }] }),
  component: ShortRedirect,
});

function ShortRedirect() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const { data, error } = await supabase
        .from("vagas")
        .select("link_token")
        .eq("short_code", code)
        .maybeSingle();
      if (cancelado) return;
      if (error || !data?.link_token) { setErro(true); return; }
      navigate({ to: "/c/$token", params: { token: data.link_token }, replace: true });
    })();
    return () => { cancelado = true; };
  }, [code, navigate]);

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: "#666", padding: 20, textAlign: "center" }}>
      {erro ? "Link inválido ou expirado." : "Abrindo a vaga…"}
    </div>
  );
}
