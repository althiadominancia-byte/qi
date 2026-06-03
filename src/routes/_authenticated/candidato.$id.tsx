import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Detalhe, type Candidato } from "./admin";
import type { Vaga } from "@/lib/recrutamento/data";
import { ROXO, CINZA } from "@/lib/recrutamento/data";

export const Route = createFileRoute("/_authenticated/candidato/$id")({
  head: () => ({ meta: [{ title: "Candidato · Estrela" }] }),
  component: CandidatoPage,
});

function CandidatoPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const router = useRouter();

  const q = useQuery({
    queryKey: ["candidato", id],
    queryFn: async () => {
      const { data: c, error } = await supabase
        .from("candidatos_televendas")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!c) return null;
      let vaga: Vaga | null = null;
      if (c.vaga_id) {
        const { data: v } = await supabase.from("vagas").select("*").eq("id", c.vaga_id).maybeSingle();
        vaga = (v as any) ?? null;
      }
      return { c: c as unknown as Candidato, vaga };
    },
  });

  const voltar = () => {
    if (window.history.length > 1) router.history.back();
    else navigate({ to: "/admin" });
  };

  if (q.isLoading) {
    return <div style={{ padding: 40, textAlign: "center", color: CINZA }}>Carregando…</div>;
  }
  if (!q.data) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <div style={{ color: CINZA, marginBottom: 12 }}>Candidato não encontrado.</div>
        <button onClick={voltar} style={{ background: ROXO, color: "#fff", border: "none", padding: "10px 18px", borderRadius: 9, fontWeight: 700, cursor: "pointer" }}>Voltar</button>
      </div>
    );
  }
  return <Detalhe c={q.data.c} vaga={q.data.vaga} onClose={voltar} />;
}
